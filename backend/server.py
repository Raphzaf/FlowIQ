from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from supabase import create_client
import os
import logging
import asyncio
from pathlib import Path
import base64
import json
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import csv
import io
import random
import calendar

# Import insights engine
from insights_engine import generate_insights

from middleware.cron_auth import verify_cron_secret
from middleware.rate_limit import RateLimitMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging early so subsequent module-level code can use it
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _env(name: str) -> Optional[str]:
    value = os.environ.get(name)
    if not value:
        return None

    value = value.strip()

    # Allow values copied with quotes from dashboards/docs.
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        value = value[1:-1].strip()

    # Allow accidental Authorization-style prefix.
    if value.lower().startswith("bearer "):
        value = value[7:].strip()

    return value or None


def _jwt_role(token: str) -> Optional[str]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        padding = "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8"))
        return payload.get("role")
    except Exception:
        return None


def _is_valid_supabase_server_key(key: str) -> bool:
    # New Supabase server keys use the sb_secret_ prefix and are not JWTs.
    if key.startswith("sb_secret_") or key.startswith("sb_secret-"):
        return True

    # Legacy server keys are JWTs with role=service_role.
    return _jwt_role(key) == "service_role"

# Storage connection (Supabase preferred, MongoDB fallback)
SUPABASE_URL = _env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")

use_supabase = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
supabase = None

client = None
db = None

if use_supabase:
    if not _is_valid_supabase_server_key(SUPABASE_SERVICE_ROLE_KEY):
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is invalid for server use. "
            "Use a Supabase service_role JWT or an sb_secret_* server key."
        )
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
else:
    mongo_url = _env("MONGO_URL")
    db_name = _env("DB_NAME")

    if not mongo_url or not db_name:
        raise RuntimeError(
            "Missing database configuration. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY "
            "or MONGO_URL + DB_NAME."
        )

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

DEFAULT_USER_ID = "demo-user"


async def _resolve_user_id(x_user_id: Optional[str], authorization: Optional[str]) -> str:
    # In Supabase mode, trust the authenticated JWT user, not a client-provided user id.
    if use_supabase:
        if not authorization:
            raise HTTPException(status_code=401, detail="Missing Authorization header")

        parts = authorization.strip().split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
            raise HTTPException(status_code=401, detail="Invalid Authorization header")

        token = parts[1].strip()
        try:
            auth_response = supabase.auth.get_user(token)
            auth_user = getattr(auth_response, "user", None)
            if auth_user is None and isinstance(auth_response, dict):
                auth_user = auth_response.get("user")

            user_id = getattr(auth_user, "id", None)
            if user_id is None and isinstance(auth_user, dict):
                user_id = auth_user.get("id")

            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid auth token")
            return str(user_id)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Unable to validate auth token")

    user_id = (x_user_id or DEFAULT_USER_ID).strip()
    if not user_id:
        return DEFAULT_USER_ID
    if len(user_id) > 128:
        raise HTTPException(status_code=400, detail="Invalid user id")
    return user_id


def _is_default_user(user_id: str) -> bool:
    return user_id == DEFAULT_USER_ID


def _default_profile(user_id: str) -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    label = user_id.replace("-", " ").replace("_", " ").title()
    return {
        "user_id": user_id,
        "display_name": label if label else "FlowIQ User",
        "currency": "USD",
        "monthly_budget": None,
        "monthly_income": None,
        "monthly_income_day": 1,
        "monthly_rent": None,
        "monthly_rent_day": 1,
        "monthly_subscriptions": None,
        "monthly_subscriptions_day": 1,
        "monthly_other_fixed_expenses": None,
        "monthly_other_fixed_expenses_day": 1,
        "timezone": "UTC",
        "onboarding_status": "not_started",
        "onboarding_step": 1,
        "onboarding_completed_at": None,
        "created_at": now_iso,
        "updated_at": now_iso,
    }


async def db_get_transactions(user_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
    if use_supabase:
        query = (
            supabase.table("transactions")
            .select("id,date,amount,category,merchant,type,user_id")
            .order("date", desc=True)
            .limit(limit)
        )

        if _is_default_user(user_id):
            query = query.or_(f"user_id.eq.{user_id},user_id.is.null")
        else:
            query = query.eq("user_id", user_id)

        response = query.execute()
        return response.data or []

    mongo_query: Dict[str, Any]
    if _is_default_user(user_id):
        mongo_query = {"$or": [{"user_id": user_id}, {"user_id": {"$exists": False}}]}
    else:
        mongo_query = {"user_id": user_id}

    return await db.transactions.find(mongo_query, {"_id": 0}).to_list(limit)


async def db_insert_transaction(transaction: Dict[str, Any]) -> None:
    if use_supabase:
        supabase.table("transactions").insert(transaction).execute()
        return

    await db.transactions.insert_one(transaction)


async def db_insert_transactions(transactions: List[Dict[str, Any]]) -> None:
    if not transactions:
        return

    if use_supabase:
        supabase.table("transactions").insert(transactions).execute()
        return

    await db.transactions.insert_many(transactions)


async def db_delete_transaction(transaction_id: str, user_id: str) -> int:
    if use_supabase:
        query = supabase.table("transactions").delete().eq("id", transaction_id)
        if _is_default_user(user_id):
            query = query.or_(f"user_id.eq.{user_id},user_id.is.null")
        else:
            query = query.eq("user_id", user_id)
        response = query.execute()
        return len(response.data or [])

    if _is_default_user(user_id):
        result = await db.transactions.delete_one(
            {"id": transaction_id, "$or": [{"user_id": user_id}, {"user_id": {"$exists": False}}]}
        )
    else:
        result = await db.transactions.delete_one({"id": transaction_id, "user_id": user_id})
    return result.deleted_count


async def db_update_transaction(transaction_id: str, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if use_supabase:
        query = supabase.table("transactions").update(updates).eq("id", transaction_id)
        if _is_default_user(user_id):
            query = query.or_(f"user_id.eq.{user_id},user_id.is.null")
        else:
            query = query.eq("user_id", user_id)

        response = query.execute()
        rows = response.data or []
        return rows[0] if rows else None

    if _is_default_user(user_id):
        filter_query = {"id": transaction_id, "$or": [{"user_id": user_id}, {"user_id": {"$exists": False}}]}
    else:
        filter_query = {"id": transaction_id, "user_id": user_id}

    await db.transactions.update_one(filter_query, {"$set": updates})
    return await db.transactions.find_one(filter_query, {"_id": 0})


async def db_count_transactions() -> int:
    if use_supabase:
        response = supabase.table("transactions").select("id", count="exact").limit(1).execute()
        return response.count or 0

    return await db.transactions.count_documents({})


async def db_clear_transactions(user_id: str) -> None:
    if use_supabase:
        query = supabase.table("transactions").delete().neq("id", "")
        if _is_default_user(user_id):
            query = query.or_(f"user_id.eq.{user_id},user_id.is.null")
        else:
            query = query.eq("user_id", user_id)
        query.execute()
        return

    if _is_default_user(user_id):
        await db.transactions.delete_many({"$or": [{"user_id": user_id}, {"user_id": {"$exists": False}}]})
        return

    await db.transactions.delete_many({"user_id": user_id})


async def db_get_profile(user_id: str) -> Optional[Dict[str, Any]]:
    if use_supabase:
        response = (
            supabase.table("user_profiles")
            .select("user_id,display_name,currency,monthly_budget,monthly_income,monthly_income_day,monthly_rent,monthly_rent_day,monthly_subscriptions,monthly_subscriptions_day,monthly_other_fixed_expenses,monthly_other_fixed_expenses_day,timezone,created_at,updated_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None

    return await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})


async def db_upsert_profile(profile: Dict[str, Any]) -> Dict[str, Any]:
    if use_supabase:
        response = (
            supabase.table("user_profiles")
            .upsert(profile, on_conflict="user_id")
            .execute()
        )
        rows = response.data or []
        if rows:
            return rows[0]

        selected = await db_get_profile(profile["user_id"])
        if selected:
            return selected
        return profile

    await db.user_profiles.update_one(
        {"user_id": profile["user_id"]},
        {"$set": profile},
        upsert=True,
    )
    saved = await db.user_profiles.find_one({"user_id": profile["user_id"]}, {"_id": 0})
    return saved or profile

# Define Models
class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    amount: float
    category: str
    merchant: str
    type: str = "expense"
    user_id: Optional[str] = None

class TransactionCreate(BaseModel):
    date: str
    amount: float
    category: str
    merchant: str
    type: str = "expense"


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    merchant: Optional[str] = None
    type: Optional[str] = None


class UserProfile(BaseModel):
    user_id: str
    display_name: str
    currency: str = "USD"
    monthly_budget: Optional[float] = None
    monthly_income: Optional[float] = None
    monthly_income_day: int = 1
    monthly_rent: Optional[float] = None
    monthly_rent_day: int = 1
    monthly_subscriptions: Optional[float] = None
    monthly_subscriptions_day: int = 1
    monthly_other_fixed_expenses: Optional[float] = None
    monthly_other_fixed_expenses_day: int = 1
    timezone: str = "UTC"
    onboarding_status: Optional[str] = "not_started"
    onboarding_step: Optional[int] = 1
    onboarding_completed_at: Optional[str] = None
    created_at: str
    updated_at: str


class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    currency: Optional[str] = None
    monthly_budget: Optional[float] = None
    monthly_income: Optional[float] = None
    monthly_income_day: Optional[int] = None
    monthly_rent: Optional[float] = None
    monthly_rent_day: Optional[int] = None
    monthly_subscriptions: Optional[float] = None
    monthly_subscriptions_day: Optional[int] = None
    monthly_other_fixed_expenses: Optional[float] = None
    monthly_other_fixed_expenses_day: Optional[int] = None
    timezone: Optional[str] = None
    onboarding_status: Optional[str] = None
    onboarding_step: Optional[int] = None
    onboarding_completed_at: Optional[str] = None


class OnboardingUpdate(BaseModel):
    onboarding_status: Optional[str] = None
    onboarding_step: Optional[int] = None
    onboarding_completed_at: Optional[str] = None
    currency: Optional[str] = None


class MonthlyPlanApplyResult(BaseModel):
    month: str
    created_count: int
    skipped_count: int
    created_transactions: List[Transaction]

class DashboardSummary(BaseModel):
    total_balance: float
    total_income: float
    total_expenses: float
    monthly_spending: float
    categories: dict
    spending_by_month: List[dict]

class CashflowPrediction(BaseModel):
    current_balance: float
    predicted_end_balance: float
    daily_average_spending: float
    days_remaining: int
    is_warning: bool
    message: str

# Demo data categories
CATEGORIES = ["Food & Dining", "Transport", "Shopping", "Subscriptions", "Entertainment", "Bills & Utilities", "Health", "Travel"]
MERCHANTS = {
    "Food & Dining": ["Starbucks", "Uber Eats", "Whole Foods", "Chipotle", "McDonald's", "DoorDash"],
    "Transport": ["Uber", "Lyft", "Shell Gas", "Chevron", "Metro Transit"],
    "Shopping": ["Amazon", "Target", "Walmart", "Best Buy", "Nike"],
    "Subscriptions": ["Netflix", "Spotify", "Apple Music", "HBO Max", "Adobe", "Notion"],
    "Entertainment": ["AMC Theaters", "Steam", "PlayStation", "Concert Tickets"],
    "Bills & Utilities": ["Electric Company", "Water Bill", "Internet Provider", "Phone Bill"],
    "Health": ["CVS Pharmacy", "Gym Membership", "Doctor Visit"],
    "Travel": ["Airbnb", "Delta Airlines", "Booking.com", "Hertz"]
}

def generate_demo_data():
    """Generate demo transactions for the past 3 months"""
    transactions = []
    today = datetime.now(timezone.utc)
    
    # Add income (salary)
    for i in range(3):
        month_date = today - timedelta(days=30 * i)
        transactions.append({
            "id": str(uuid.uuid4()),
            "date": month_date.replace(day=1).strftime("%Y-%m-%d"),
            "amount": 0,
            "category": "Income",
            "merchant": "Salary Deposit",
            "type": "income"
        })
    
    # Add expenses
    for i in range(90):
        date = today - timedelta(days=i)
        num_transactions = random.randint(1, 4)
        
        for _ in range(num_transactions):
            category = random.choice(CATEGORIES)
            merchant = random.choice(MERCHANTS[category])
            
            # Amount ranges by category
            amount_ranges = {
                "Food & Dining": (8, 65),
                "Transport": (5, 50),
                "Shopping": (15, 200),
                "Subscriptions": (9.99, 29.99),
                "Entertainment": (10, 80),
                "Bills & Utilities": (50, 200),
                "Health": (20, 150),
                "Travel": (100, 500)
            }
            
            min_amt, max_amt = amount_ranges[category]
            amount = 0
            
            transactions.append({
                "id": str(uuid.uuid4()),
                "date": date.strftime("%Y-%m-%d"),
                "amount": amount,
                "category": category,
                "merchant": merchant,
                "type": "expense"
            })
    
    return transactions


def _attach_user_id(transactions: List[Dict[str, Any]], user_id: str) -> List[Dict[str, Any]]:
    for tx in transactions:
        tx["user_id"] = user_id
    return transactions

@api_router.get("/")
async def root():
    return {"message": "FlowIQ API - Your Smart CFO"}

@api_router.get("/profile", response_model=UserProfile)
async def get_profile(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_id = await _resolve_user_id(x_user_id, authorization)
    profile = await db_get_profile(user_id)
    if not profile:
        profile = await db_upsert_profile(_default_profile(user_id))
    return UserProfile(**profile)


@api_router.put("/profile", response_model=UserProfile)
async def update_profile(
    payload: UserProfileUpdate,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_id = await _resolve_user_id(x_user_id, authorization)
    current = await db_get_profile(user_id)
    if not current:
        current = _default_profile(user_id)

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}

    day_fields = [
        "monthly_income_day",
        "monthly_rent_day",
        "monthly_subscriptions_day",
        "monthly_other_fixed_expenses_day",
    ]
    for field in day_fields:
        if field in updates:
            day_value = int(updates[field])
            if day_value < 1 or day_value > 31:
                raise HTTPException(status_code=400, detail=f"{field} must be between 1 and 31")

    merged = {
        **current,
        **updates,
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if not merged.get("created_at"):
        merged["created_at"] = datetime.now(timezone.utc).isoformat()

    saved = await db_upsert_profile(merged)
    return UserProfile(**saved)


@api_router.patch("/onboarding", response_model=UserProfile)
async def update_onboarding(
    payload: OnboardingUpdate,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_id = await _resolve_user_id(x_user_id, authorization)
    current = await db_get_profile(user_id)
    if not current:
        current = _default_profile(user_id)

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}

    if "onboarding_status" in updates:
        allowed_statuses = {"not_started", "in_progress", "completed"}
        if updates["onboarding_status"] not in allowed_statuses:
            raise HTTPException(status_code=400, detail="onboarding_status must be one of: not_started, in_progress, completed")

    if updates.get("onboarding_status") == "completed" and not updates.get("onboarding_completed_at"):
        updates["onboarding_completed_at"] = datetime.now(timezone.utc).isoformat()

    merged = {
        **current,
        **updates,
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if not merged.get("created_at"):
        merged["created_at"] = datetime.now(timezone.utc).isoformat()

    saved = await db_upsert_profile(merged)
    return UserProfile(**saved)


@api_router.post("/monthly-plan/apply", response_model=MonthlyPlanApplyResult)
async def apply_monthly_plan(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_id = await _resolve_user_id(x_user_id, authorization)
    profile = await db_get_profile(user_id)
    if not profile:
        profile = await db_upsert_profile(_default_profile(user_id))

    today = datetime.now(timezone.utc)
    month_prefix = today.strftime("%Y-%m")
    _, days_in_month = calendar.monthrange(today.year, today.month)

    def _monthly_date(day_value: Any) -> str:
        try:
            day_int = int(day_value)
        except (TypeError, ValueError):
            day_int = 1
        if day_int < 1:
            day_int = 1
        if day_int > 31:
            day_int = 31
        day = min(day_int, days_in_month)
        return datetime(today.year, today.month, day, tzinfo=timezone.utc).strftime("%Y-%m-%d")

    def _to_positive(value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        if parsed <= 0:
            return None
        return round(parsed, 2)

    monthly_income = _to_positive(profile.get("monthly_income"))
    monthly_income_day = profile.get("monthly_income_day", 1)
    monthly_rent = _to_positive(profile.get("monthly_rent"))
    monthly_rent_day = profile.get("monthly_rent_day", 1)
    monthly_subscriptions = _to_positive(profile.get("monthly_subscriptions"))
    monthly_subscriptions_day = profile.get("monthly_subscriptions_day", 1)
    monthly_other_fixed_expenses = _to_positive(profile.get("monthly_other_fixed_expenses"))
    monthly_other_fixed_expenses_day = profile.get("monthly_other_fixed_expenses_day", 1)

    monthly_plan = []
    if monthly_income is not None:
        monthly_plan.append(
            {
                "date": _monthly_date(monthly_income_day),
                "amount": monthly_income,
                "category": "Income",
                "merchant": "Salaire mensuel",
                "type": "income",
                "user_id": user_id,
            }
        )
    if monthly_rent is not None:
        monthly_plan.append(
            {
                "date": _monthly_date(monthly_rent_day),
                "amount": monthly_rent,
                "category": "Bills & Utilities",
                "merchant": "Loyer appartement",
                "type": "expense",
                "user_id": user_id,
            }
        )
    if monthly_subscriptions is not None:
        monthly_plan.append(
            {
                "date": _monthly_date(monthly_subscriptions_day),
                "amount": monthly_subscriptions,
                "category": "Subscriptions",
                "merchant": "Abonnements mensuels",
                "type": "expense",
                "user_id": user_id,
            }
        )
    if monthly_other_fixed_expenses is not None:
        monthly_plan.append(
            {
                "date": _monthly_date(monthly_other_fixed_expenses_day),
                "amount": monthly_other_fixed_expenses,
                "category": "Bills & Utilities",
                "merchant": "Charges fixes mensuelles",
                "type": "expense",
                "user_id": user_id,
            }
        )

    if not monthly_plan:
        return MonthlyPlanApplyResult(
            month=month_prefix,
            created_count=0,
            skipped_count=0,
            created_transactions=[],
        )

    existing_transactions = await db_get_transactions(user_id=user_id, limit=2000)
    existing_keys = set()
    for tx in existing_transactions:
        tx_date = str(tx.get("date", ""))
        if not tx_date.startswith(month_prefix):
            continue
        key = (
            tx_date,
            tx.get("type", "expense"),
            tx.get("category", ""),
            tx.get("merchant", ""),
            round(float(tx.get("amount", 0)), 2),
        )
        existing_keys.add(key)

    to_create: List[Transaction] = []
    skipped_count = 0
    for item in monthly_plan:
        key = (
            item["date"],
            item["type"],
            item["category"],
            item["merchant"],
            round(float(item["amount"]), 2),
        )
        if key in existing_keys:
            skipped_count += 1
            continue

        tx = Transaction(**{**item, "id": str(uuid.uuid4())})
        to_create.append(tx)

    if to_create:
        await db_insert_transactions([tx.model_dump() for tx in to_create])

    return MonthlyPlanApplyResult(
        month=month_prefix,
        created_count=len(to_create),
        skipped_count=skipped_count,
        created_transactions=to_create,
    )


@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_id = await _resolve_user_id(x_user_id, authorization)
    transactions = await db_get_transactions(user_id=user_id, limit=1000)
    return transactions

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(
    transaction: TransactionCreate,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_id = await _resolve_user_id(x_user_id, authorization)
    trans_dict = transaction.model_dump()
    trans_dict["user_id"] = user_id
    trans_obj = Transaction(**trans_dict)
    doc = trans_obj.model_dump()
    await db_insert_transaction(doc)
    return trans_obj

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(
    transaction_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_id = await _resolve_user_id(x_user_id, authorization)
    deleted_count = await db_delete_transaction(transaction_id, user_id)
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted"}


@api_router.put("/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_id = await _resolve_user_id(x_user_id, authorization)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await db_update_transaction(transaction_id, user_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return Transaction(**updated)

@api_router.post("/seed-demo-data")
async def seed_demo_data(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Seed the database with demo data"""
    user_id = await _resolve_user_id(x_user_id, authorization)
    existing_transactions = await db_get_transactions(user_id=user_id, limit=1)
    if existing_transactions:
        return {"message": "Demo data already exists", "count": len(existing_transactions)}
    
    demo_data = generate_demo_data()
    demo_data = _attach_user_id(demo_data, user_id)
    await db_insert_transactions(demo_data)
    return {"message": "Demo data seeded successfully", "count": len(demo_data)}

@api_router.delete("/clear-data")
async def clear_data(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Clear all transaction data"""
    user_id = await _resolve_user_id(x_user_id, authorization)
    await db_clear_transactions(user_id)
    return {"message": "All data cleared"}

@api_router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_id = await _resolve_user_id(x_user_id, authorization)
    transactions = await db_get_transactions(user_id=user_id, limit=1000)
    
    if not transactions:
        return DashboardSummary(
            total_balance=0,
            total_income=0,
            total_expenses=0,
            monthly_spending=0,
            categories={},
            spending_by_month=[]
        )
    
    total_income = sum(t["amount"] for t in transactions if t.get("type") == "income")
    total_expenses = sum(t["amount"] for t in transactions if t.get("type") == "expense")
    total_balance = total_income - total_expenses
    
    today = datetime.now(timezone.utc)
    current_month = today.strftime("%Y-%m")
    monthly_spending = sum(
        t["amount"] for t in transactions 
        if t.get("type") == "expense" and t["date"].startswith(current_month)
    )
    
    categories = {}
    for t in transactions:
        if t.get("type") == "expense":
            cat = t["category"]
            categories[cat] = categories.get(cat, 0) + t["amount"]
    
    categories = {k: round(v, 2) for k, v in categories.items()}
    
    spending_by_month = []
    for i in range(5, -1, -1):
        month_date = today - timedelta(days=30 * i)
        month_key = month_date.strftime("%Y-%m")
        month_name = month_date.strftime("%b")
        
        month_total = sum(
            t["amount"] for t in transactions 
            if t.get("type") == "expense" and t["date"].startswith(month_key)
        )
        
        spending_by_month.append({
            "month": month_name,
            "amount": round(month_total, 2)
        })
    
    return DashboardSummary(
        total_balance=round(total_balance, 2),
        total_income=round(total_income, 2),
        total_expenses=round(total_expenses, 2),
        monthly_spending=round(monthly_spending, 2),
        categories=categories,
        spending_by_month=spending_by_month
    )

@api_router.get("/insights-advanced")
async def get_advanced_insights(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Get advanced AI-powered insights with personality and health score"""
    user_id = await _resolve_user_id(x_user_id, authorization)
    transactions = await db_get_transactions(user_id=user_id, limit=1000)
    
    if not transactions:
        return {
            "insights": [{
                "id": "no_data",
                "type": "info",
                "icon": "upload",
                "title": "No Data Yet",
                "headline": "Upload your bank statement to get started",
                "description": "Once you upload your transactions, we'll analyze your spending patterns and provide personalized insights.",
                "data": {},
                "priority": 0
            }],
            "personality": {
                "type": "unknown",
                "label": "New User",
                "emoji": "👋",
                "description": "We need more data to understand your spending style.",
                "traits": [],
                "recommendations": ["Upload your bank statement to get personalized insights."]
            },
            "health_score": {
                "score": 0,
                "grade": "N/A",
                "description": "Not enough data to calculate your score.",
                "factors": []
            }
        }
    
    # Generate insights using the engine
    result = generate_insights(transactions)
    
    # Sort insights by priority (lower = more important)
    result["insights"] = sorted(result["insights"], key=lambda x: x.get("priority", 99))
    
    return result

@api_router.get("/insights")
async def get_insights(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Legacy insights endpoint - returns simplified format"""
    advanced = await get_advanced_insights(x_user_id=x_user_id, authorization=authorization)
    
    # Convert to simple format for backwards compatibility
    simple_insights = []
    for insight in advanced.get("insights", []):
        simple_insights.append({
            "id": insight.get("id", str(uuid.uuid4())),
            "type": insight.get("type", "info"),
            "title": insight.get("title", ""),
            "description": insight.get("headline", "") + " " + insight.get("description", ""),
            "icon": insight.get("icon", "info")
        })
    
    return simple_insights[:5]

@api_router.get("/cashflow-prediction", response_model=CashflowPrediction)
async def get_cashflow_prediction(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_id = await _resolve_user_id(x_user_id, authorization)
    transactions = await db_get_transactions(user_id=user_id, limit=1000)
    
    if not transactions:
        return CashflowPrediction(
            current_balance=0,
            predicted_end_balance=0,
            daily_average_spending=0,
            days_remaining=0,
            is_warning=False,
            message="No data available for prediction"
        )
    
    today = datetime.now(timezone.utc)
    
    total_income = sum(t["amount"] for t in transactions if t.get("type") == "income")
    total_expenses = sum(t["amount"] for t in transactions if t.get("type") == "expense")
    current_balance = total_income - total_expenses
    
    thirty_days_ago = today - timedelta(days=30)
    recent_expenses = [
        t for t in transactions 
        if t.get("type") == "expense" and 
        datetime.strptime(t["date"].strip(), "%Y-%m-%d") >= thirty_days_ago.replace(tzinfo=None)
    ]
    
    daily_average = sum(t["amount"] for t in recent_expenses) / 30 if recent_expenses else 0
    
    import calendar
    _, days_in_month = calendar.monthrange(today.year, today.month)
    days_remaining = days_in_month - today.day
    
    predicted_spending = daily_average * days_remaining
    predicted_end_balance = current_balance - predicted_spending
    
    is_warning = predicted_end_balance < 0
    
    if is_warning:
        message = f"Warning: At your current spending rate, you may go ${abs(predicted_end_balance):.2f} over budget by month end."
    elif predicted_end_balance < 500:
        message = f"Caution: Your predicted end-of-month balance is ${predicted_end_balance:.2f}. Consider reducing expenses."
    else:
        message = f"You're on track! Predicted end-of-month balance: ${predicted_end_balance:.2f}"
    
    return CashflowPrediction(
        current_balance=round(current_balance, 2),
        predicted_end_balance=round(predicted_end_balance, 2),
        daily_average_spending=round(daily_average, 2),
        days_remaining=days_remaining,
        is_warning=is_warning,
        message=message
    )

@api_router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Upload and parse a bank statement CSV file"""
    user_id = await _resolve_user_id(x_user_id, authorization)
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        contents = await file.read()
        decoded = contents.decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded))
        
        transactions = []
        for row in reader:
            date = row.get('date') or row.get('Date') or row.get('DATE') or row.get('Transaction Date')
            amount = row.get('amount') or row.get('Amount') or row.get('AMOUNT') or row.get('Debit')
            category = row.get('category') or row.get('Category') or row.get('CATEGORY') or "Uncategorized"
            merchant = row.get('merchant') or row.get('Merchant') or row.get('Description') or row.get('DESCRIPTION') or "Unknown"
            trans_type = row.get('type') or row.get('Type') or "expense"
            
            if date and amount:
                try:
                    amount_str = str(amount).replace('$', '').replace(',', '').strip()
                    amount_val = abs(float(amount_str))
                    
                    if float(amount_str) > 0 and trans_type.lower() not in ['expense', 'debit']:
                        trans_type = "income"
                    else:
                        trans_type = "expense"
                    
                    transactions.append({
                        "id": str(uuid.uuid4()),
                        "date": date,
                        "amount": amount_val,
                        "category": category,
                        "merchant": merchant[:100],
                        "type": trans_type,
                        "user_id": user_id,
                    })
                except ValueError:
                    continue
        
        if not transactions:
            raise HTTPException(status_code=400, detail="No valid transactions found in CSV")
        
        await db_insert_transactions(transactions)
        
        return {
            "message": f"Successfully imported {len(transactions)} transactions",
            "count": len(transactions)
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")

# ---------------------------------------------------------------------------
# Israeli Bank Integration endpoints
# ---------------------------------------------------------------------------

from integrations.israel_banks.connector import SUPPORTED_BANKS
from integrations.israel_banks.connectors import HapoalimConnector, LeumiConnector, DiscountConnector
from integrations.israel_banks.crypto import encrypt_credentials, decrypt_credentials
from integrations.israel_banks.normalizer import normalize_transaction, normalize_account
from integrations.israel_banks.scheduler import BankSyncScheduler

_BANK_CONNECTORS = {
    "hapoalim": HapoalimConnector,
    "leumi": LeumiConnector,
    "discount": DiscountConnector,
}

# ---------------------------------------------------------------------------
# DB helpers – bank connections
# ---------------------------------------------------------------------------

async def db_get_bank_connections(user_id: str) -> List[Dict[str, Any]]:
    if use_supabase:
        response = (
            supabase.table("bank_connections")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return response.data or []
    return await db.bank_connections.find({"user_id": user_id}, {"_id": 0}).to_list(100)


async def db_get_all_active_bank_connections() -> List[Dict[str, Any]]:
    if use_supabase:
        response = (
            supabase.table("bank_connections")
            .select("*")
            .eq("status", "connected")
            .execute()
        )
        return response.data or []
    return await db.bank_connections.find({"status": "connected"}, {"_id": 0}).to_list(1000)


async def db_upsert_bank_connection(conn: Dict[str, Any]) -> Dict[str, Any]:
    if use_supabase:
        response = (
            supabase.table("bank_connections")
            .upsert(conn, on_conflict="id")
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else conn
    await db.bank_connections.update_one(
        {"id": conn["id"]}, {"$set": conn}, upsert=True
    )
    return conn


async def db_delete_bank_connection(conn_id: str, user_id: str) -> int:
    if use_supabase:
        response = (
            supabase.table("bank_connections")
            .delete()
            .eq("id", conn_id)
            .eq("user_id", user_id)
            .execute()
        )
        return len(response.data or [])
    result = await db.bank_connections.delete_one({"id": conn_id, "user_id": user_id})
    return result.deleted_count


async def db_upsert_transactions_by_external_id(transactions: List[Dict[str, Any]]) -> None:
    """Insert transactions that don't already exist (de-dup by external_id)."""
    if not transactions:
        return
    if use_supabase:
        supabase.table("transactions").upsert(transactions, on_conflict="external_id").execute()
        return
    for tx in transactions:
        await db.transactions.update_one(
            {"external_id": tx["external_id"]},
            {"$set": tx},
            upsert=True,
        )


# ---------------------------------------------------------------------------
# Pydantic models for the bank endpoints
# ---------------------------------------------------------------------------

class BankConnectRequest(BaseModel):
    bank_id: str
    username: str
    password: str


class BankSyncResponse(BaseModel):
    bank_id: str
    account_count: int
    transaction_count: int
    synced_at: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@api_router.get("/banks/israel/supported")
async def list_supported_banks():
    """Return metadata for all supported Israeli banks."""
    return list(SUPPORTED_BANKS.values())


@api_router.get("/banks/israel/connections")
async def get_bank_connections(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """List the current user's bank connections (credentials are not returned)."""
    user_id = await _resolve_user_id(x_user_id, authorization)
    connections = await db_get_bank_connections(user_id)
    # Strip sensitive fields before returning
    safe = []
    for c in connections:
        safe.append({k: v for k, v in c.items() if k != "encrypted_credentials"})
    return safe


@api_router.post("/banks/israel/connect")
async def connect_bank(
    payload: BankConnectRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Initiate a connection to an Israeli bank and run the first sync."""
    user_id = await _resolve_user_id(x_user_id, authorization)

    if payload.bank_id not in _BANK_CONNECTORS:
        raise HTTPException(status_code=400, detail=f"Unsupported bank: {payload.bank_id}")

    ConnectorCls = _BANK_CONNECTORS[payload.bank_id]
    connector = ConnectorCls()

    credentials = {"username": payload.username, "password": payload.password}

    try:
        session = connector.login(credentials)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {exc}")

    # Fetch accounts to confirm connection
    try:
        accounts = connector.fetch_accounts(session)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch accounts: {exc}")

    connector.logout(session)

    now_iso = datetime.now(timezone.utc).isoformat()
    conn_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{user_id}:{payload.bank_id}"))

    conn_record = {
        "id": conn_id,
        "user_id": user_id,
        "bank_id": payload.bank_id,
        "bank_name": SUPPORTED_BANKS[payload.bank_id]["name"],
        "status": "connected",
        "encrypted_credentials": encrypt_credentials(credentials),
        "accounts": [normalize_account(a) for a in accounts],
        "last_synced_at": None,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    await db_upsert_bank_connection(conn_record)

    return {k: v for k, v in conn_record.items() if k != "encrypted_credentials"}


@api_router.post("/banks/israel/disconnect")
async def disconnect_bank(
    payload: Dict[str, str],
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Remove a bank connection."""
    user_id = await _resolve_user_id(x_user_id, authorization)
    bank_id = payload.get("bank_id", "")
    conn_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{user_id}:{bank_id}"))
    deleted = await db_delete_bank_connection(conn_id, user_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"message": f"Disconnected from {bank_id}"}


@api_router.get("/banks/israel/accounts")
async def get_bank_accounts(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Return all bank accounts across all connected institutions."""
    user_id = await _resolve_user_id(x_user_id, authorization)
    connections = await db_get_bank_connections(user_id)
    all_accounts = []
    for conn in connections:
        if conn.get("status") != "connected":
            continue
        for acc in conn.get("accounts", []):
            all_accounts.append({**acc, "bank_name": conn.get("bank_name", conn.get("bank_id"))})
    return all_accounts


@api_router.post("/banks/israel/sync", response_model=BankSyncResponse)
async def manual_sync(
    payload: Dict[str, str],
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Manually trigger a transaction sync for a specific bank connection."""
    user_id = await _resolve_user_id(x_user_id, authorization)
    bank_id = payload.get("bank_id", "")
    conn_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{user_id}:{bank_id}"))

    connections = await db_get_bank_connections(user_id)
    conn = next((c for c in connections if c.get("id") == conn_id), None)
    if not conn:
        raise HTTPException(status_code=404, detail="Bank connection not found")

    ConnectorCls = _BANK_CONNECTORS.get(bank_id)
    if ConnectorCls is None:
        raise HTTPException(status_code=400, detail=f"Unsupported bank: {bank_id}")

    try:
        creds = decrypt_credentials(conn["encrypted_credentials"])
        connector = ConnectorCls()
        session = connector.login(creds)
        accounts = connector.fetch_accounts(session)

        last_synced_at = conn.get("last_synced_at")
        from_date = (
            datetime.fromisoformat(last_synced_at).date()
            if last_synced_at
            else (datetime.now(timezone.utc) - timedelta(days=30)).date()
        )
        to_date = datetime.now(timezone.utc).date()

        all_txs: List[Dict[str, Any]] = []
        for account in accounts:
            raw_txs = connector.fetch_transactions(session, account.account_id, from_date, to_date)
            for raw in raw_txs:
                normalized = normalize_transaction(raw, user_id=user_id, source_label=f"Israel Bank – {bank_id}")
                all_txs.append(normalized)

        connector.logout(session)

        if all_txs:
            await db_upsert_transactions_by_external_id(all_txs)

        now_iso = datetime.now(timezone.utc).isoformat()
        conn["last_synced_at"] = now_iso
        conn["updated_at"] = now_iso
        conn["accounts"] = [normalize_account(a) for a in accounts]
        await db_upsert_bank_connection(conn)

        return BankSyncResponse(
            bank_id=bank_id,
            account_count=len(accounts),
            transaction_count=len(all_txs),
            synced_at=now_iso,
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Sync failed: {exc}")


# ---------------------------------------------------------------------------
# Woob Bank Integration endpoints
# ---------------------------------------------------------------------------

try:
    from integrations.woob.registry import get_supported_banks as _get_woob_banks
    from integrations.woob.connector import WoobBankConnector
    _WOOB_AVAILABLE = True
except Exception as _woob_import_err:
    logger.warning("Woob integration unavailable: %s", _woob_import_err)
    _WOOB_AVAILABLE = False

    def _get_woob_banks():
        return {}

    class WoobBankConnector:  # type: ignore[no-redef]
        def __init__(self, bank_id: str) -> None:
            raise RuntimeError("Woob is not installed")


class WoobConnectRequest(BaseModel):
    bank_id: str
    login: str
    password: str


class WoobSyncResponse(BaseModel):
    bank_id: str
    account_count: int
    transaction_count: int
    synced_at: str


# ---------------------------------------------------------------------------
# DB helpers – Woob bank connections (reuse same table with connector_type)
# ---------------------------------------------------------------------------

async def db_get_woob_connections(user_id: str) -> List[Dict[str, Any]]:
    """Return all Woob-type bank connections for *user_id*."""
    all_conn = await db_get_bank_connections(user_id)
    return [c for c in all_conn if c.get("connector_type") == "woob"]


async def db_get_all_active_woob_connections() -> List[Dict[str, Any]]:
    if use_supabase:
        response = (
            supabase.table("bank_connections")
            .select("*")
            .eq("status", "connected")
            .eq("connector_type", "woob")
            .execute()
        )
        return response.data or []
    return await db.bank_connections.find(
        {"status": "connected", "connector_type": "woob"}, {"_id": 0}
    ).to_list(1000)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@api_router.get("/banks/woob/supported")
async def woob_list_supported_banks():
    """Return metadata for all supported Woob bank modules."""
    banks = _get_woob_banks()
    return list(banks.values())


@api_router.get("/banks/woob/connections")
async def woob_get_connections(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """List the current user's Woob bank connections (credentials not returned)."""
    user_id = await _resolve_user_id(x_user_id, authorization)
    connections = await db_get_woob_connections(user_id)
    safe = [{k: v for k, v in c.items() if k != "encrypted_credentials"} for c in connections]
    return safe


@api_router.post("/banks/woob/connect")
async def woob_connect_bank(
    payload: WoobConnectRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Connect to a Woob-supported bank and perform the initial sync."""
    if not _WOOB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Woob integration is not available on this server")

    user_id = await _resolve_user_id(x_user_id, authorization)

    supported = _get_woob_banks()
    if payload.bank_id not in supported:
        raise HTTPException(status_code=400, detail=f"Unsupported Woob bank: {payload.bank_id}")

    credentials = {"login": payload.login, "password": payload.password}

    try:
        connector = WoobBankConnector(payload.bank_id)
        session = await asyncio.to_thread(connector.login, credentials)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Connection failed: {exc}")

    try:
        accounts = await asyncio.to_thread(connector.fetch_accounts, session)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch accounts: {exc}")

    await asyncio.to_thread(connector.logout, session)

    bank_meta = supported[payload.bank_id]
    now_iso = datetime.now(timezone.utc).isoformat()
    conn_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{user_id}:woob:{payload.bank_id}"))

    conn_record = {
        "id": conn_id,
        "user_id": user_id,
        "bank_id": payload.bank_id,
        "bank_name": bank_meta.get("name", payload.bank_id),
        "connector_type": "woob",
        "status": "connected",
        "encrypted_credentials": encrypt_credentials(credentials),
        "accounts": [normalize_account(a) for a in accounts],
        "last_synced_at": None,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    await db_upsert_bank_connection(conn_record)
    return {k: v for k, v in conn_record.items() if k != "encrypted_credentials"}


@api_router.post("/banks/woob/disconnect")
async def woob_disconnect_bank(
    payload: Dict[str, str],
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Remove a Woob bank connection."""
    user_id = await _resolve_user_id(x_user_id, authorization)
    bank_id = payload.get("bank_id", "")
    conn_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{user_id}:woob:{bank_id}"))
    deleted = await db_delete_bank_connection(conn_id, user_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"message": f"Disconnected from {bank_id}"}


@api_router.get("/banks/woob/accounts")
async def woob_get_accounts(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Return all bank accounts across all connected Woob institutions."""
    user_id = await _resolve_user_id(x_user_id, authorization)
    connections = await db_get_woob_connections(user_id)
    all_accounts = []
    for conn in connections:
        if conn.get("status") != "connected":
            continue
        for acc in conn.get("accounts", []):
            all_accounts.append({**acc, "bank_name": conn.get("bank_name", conn.get("bank_id"))})
    return all_accounts


@api_router.post("/banks/woob/sync", response_model=WoobSyncResponse)
async def woob_manual_sync(
    payload: Dict[str, str],
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Manually trigger a transaction sync for a specific Woob bank connection."""
    if not _WOOB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Woob integration is not available on this server")

    user_id = await _resolve_user_id(x_user_id, authorization)
    bank_id = payload.get("bank_id", "")
    conn_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{user_id}:woob:{bank_id}"))

    connections = await db_get_woob_connections(user_id)
    conn = next((c for c in connections if c.get("id") == conn_id), None)
    if not conn:
        raise HTTPException(status_code=404, detail="Woob bank connection not found")

    try:
        creds = decrypt_credentials(conn["encrypted_credentials"])
        connector = WoobBankConnector(bank_id)
        session = await asyncio.to_thread(connector.login, creds)
        accounts = await asyncio.to_thread(connector.fetch_accounts, session)

        last_synced_at = conn.get("last_synced_at")
        from_date = (
            datetime.fromisoformat(last_synced_at).date()
            if last_synced_at
            else (datetime.now(timezone.utc) - timedelta(days=30)).date()
        )
        to_date = datetime.now(timezone.utc).date()

        all_txs: List[Dict[str, Any]] = []
        for account in accounts:
            raw_txs = await asyncio.to_thread(
                connector.fetch_transactions, session, account.account_id, from_date, to_date
            )
            for raw in raw_txs:
                normalized = normalize_transaction(
                    raw, user_id=user_id, source_label=f"Woob – {bank_id}"
                )
                all_txs.append(normalized)

        await asyncio.to_thread(connector.logout, session)

        if all_txs:
            await db_upsert_transactions_by_external_id(all_txs)

        now_iso = datetime.now(timezone.utc).isoformat()
        conn["last_synced_at"] = now_iso
        conn["updated_at"] = now_iso
        conn["accounts"] = [normalize_account(a) for a in accounts]
        await db_upsert_bank_connection(conn)

        return WoobSyncResponse(
            bank_id=bank_id,
            account_count=len(accounts),
            transaction_count=len(all_txs),
            synced_at=now_iso,
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Woob sync failed: {exc}")


# ---------------------------------------------------------------------------
# Cross-connector cron sync endpoint
# Designed to be called by Vercel Cron (or any scheduler).
# Protected by CRON_SECRET env var when set.
# ---------------------------------------------------------------------------

@api_router.post("/banks/sync-all")
async def sync_all_banks(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """
    Sync all active bank connections (Israeli + Woob) for all users.

    Intended for use with Vercel Cron or a similar scheduler.
    Requires ``CRON_SECRET`` env var in production; checked via
    ``X-Cron-Secret`` header using constant-time comparison.
    """
    verify_cron_secret(x_cron_secret)

    results: Dict[str, Any] = {"israel": [], "woob": [], "errors": []}

    # ── Israeli bank connections ──────────────────────────────────────────
    try:
        israel_connections = await db_get_all_active_bank_connections()
    except Exception as exc:
        results["errors"].append(f"Failed to load Israeli connections: {exc}")
        israel_connections = []

    for conn in israel_connections:
        if conn.get("connector_type") == "woob":
            continue  # handled below
        bank_id = conn.get("bank_id", "")
        ConnectorCls = _BANK_CONNECTORS.get(bank_id)
        if ConnectorCls is None:
            continue
        user_id = conn.get("user_id", "")
        try:
            creds = decrypt_credentials(conn["encrypted_credentials"])
            connector = ConnectorCls()
            session = await asyncio.to_thread(connector.login, creds)
            accounts = await asyncio.to_thread(connector.fetch_accounts, session)

            last_synced_at = conn.get("last_synced_at")
            from_date = (
                datetime.fromisoformat(last_synced_at).date()
                if last_synced_at
                else (datetime.now(timezone.utc) - timedelta(days=30)).date()
            )
            to_date = datetime.now(timezone.utc).date()

            all_txs: List[Dict[str, Any]] = []
            for account in accounts:
                raw_txs = await asyncio.to_thread(
                    connector.fetch_transactions, session, account.account_id, from_date, to_date
                )
                for raw in raw_txs:
                    all_txs.append(
                        normalize_transaction(raw, user_id=user_id, source_label=f"Israel Bank – {bank_id}")
                    )

            await asyncio.to_thread(connector.logout, session)

            if all_txs:
                await db_upsert_transactions_by_external_id(all_txs)

            now_iso = datetime.now(timezone.utc).isoformat()
            conn["last_synced_at"] = now_iso
            conn["updated_at"] = now_iso
            await db_upsert_bank_connection(conn)

            results["israel"].append({
                "bank_id": bank_id,
                "user_id": user_id,
                "transactions": len(all_txs),
                "status": "ok",
            })
        except Exception as exc:
            results["errors"].append(f"Israel/{bank_id}/{user_id}: {exc}")
            results["israel"].append({"bank_id": bank_id, "user_id": user_id, "status": "error", "error": str(exc)})

    # ── Woob bank connections ─────────────────────────────────────────────
    if _WOOB_AVAILABLE:
        try:
            woob_connections = await db_get_all_active_woob_connections()
        except Exception as exc:
            results["errors"].append(f"Failed to load Woob connections: {exc}")
            woob_connections = []

        for conn in woob_connections:
            bank_id = conn.get("bank_id", "")
            user_id = conn.get("user_id", "")
            try:
                creds = decrypt_credentials(conn["encrypted_credentials"])
                connector = WoobBankConnector(bank_id)
                session = await asyncio.to_thread(connector.login, creds)
                accounts = await asyncio.to_thread(connector.fetch_accounts, session)

                last_synced_at = conn.get("last_synced_at")
                from_date = (
                    datetime.fromisoformat(last_synced_at).date()
                    if last_synced_at
                    else (datetime.now(timezone.utc) - timedelta(days=30)).date()
                )
                to_date = datetime.now(timezone.utc).date()

                all_txs: List[Dict[str, Any]] = []
                for account in accounts:
                    raw_txs = await asyncio.to_thread(
                        connector.fetch_transactions, session, account.account_id, from_date, to_date
                    )
                    for raw in raw_txs:
                        all_txs.append(
                            normalize_transaction(raw, user_id=user_id, source_label=f"Woob – {bank_id}")
                        )

                await asyncio.to_thread(connector.logout, session)

                if all_txs:
                    await db_upsert_transactions_by_external_id(all_txs)

                now_iso = datetime.now(timezone.utc).isoformat()
                conn["last_synced_at"] = now_iso
                conn["updated_at"] = now_iso
                conn["accounts"] = [normalize_account(a) for a in accounts]
                await db_upsert_bank_connection(conn)

                results["woob"].append({
                    "bank_id": bank_id,
                    "user_id": user_id,
                    "transactions": len(all_txs),
                    "status": "ok",
                })
            except Exception as exc:
                results["errors"].append(f"Woob/{bank_id}/{user_id}: {exc}")
                results["woob"].append({"bank_id": bank_id, "user_id": user_id, "status": "error", "error": str(exc)})

    results["synced_at"] = datetime.now(timezone.utc).isoformat()
    return results


# ---------------------------------------------------------------------------
# Scheduler – started at app startup
# ---------------------------------------------------------------------------

_scheduler: Optional[BankSyncScheduler] = None


@app.on_event("startup")
async def startup_bank_scheduler():
    global _scheduler
    _scheduler = BankSyncScheduler(
        get_connections=db_get_all_active_bank_connections,
        upsert_transactions=db_upsert_transactions_by_external_id,
        sync_interval_hours=int(os.environ.get("ISRAEL_BANKS_SYNC_HOURS", "6")),
    )
    _scheduler.start()


# Include the router in the main app
app.include_router(api_router)

def _build_cors_origins() -> list[str]:
    """Parse CORS_ORIGINS; enforce no-wildcard rule in production."""
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    origins = [o.strip() for o in raw.split(",") if o.strip()]

    prod = any(
        os.environ.get(v, "").strip().lower() == "production"
        for v in ("ENV", "NODE_ENV", "APP_ENV")
    )

    if prod:
        if not origins:
            raise RuntimeError("CORS_ORIGINS must be set in production")
        if "*" in origins:
            raise RuntimeError("CORS_ORIGINS must not contain '*' in production")
        return origins

    # dev/staging: fall back to wildcard if nothing configured
    return origins if origins else ["*"]


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_build_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware)

@app.on_event("shutdown")
async def shutdown_db_client():
    global _scheduler
    if _scheduler:
        _scheduler.stop()
    if client is not None:
        client.close()
