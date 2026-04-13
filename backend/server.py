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


# ── BUDGETS DB HELPERS ────────────────────────────────────────────────────────
#
# Supabase SQL (run once to create the table):
# create table if not exists budgets (
#   id uuid primary key default gen_random_uuid(),
#   user_id text not null,
#   category text not null,
#   amount_ils numeric not null,
#   month text not null,  -- format: YYYY-MM
#   created_at timestamptz default now(),
#   updated_at timestamptz default now(),
#   unique(user_id, category, month)
# );


async def db_list_budgets(user_id: str, month: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return budgets for a user, optionally filtered by month (YYYY-MM)."""
    if use_supabase:
        query = supabase.table("budgets").select("*").eq("user_id", user_id)
        if month:
            query = query.eq("month", month)
        response = query.execute()
        rows = response.data or []
        # Normalise id field
        for row in rows:
            row.setdefault("id", row.get("id", ""))
        return rows

    mongo_query: Dict[str, Any] = {"user_id": user_id}
    if month:
        mongo_query["month"] = month
    cursor = db["budgets"].find(mongo_query)
    rows = await cursor.to_list(None)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return rows


async def db_upsert_budget(user_id: str, category: str, amount_ils: float, month: str) -> Dict[str, Any]:
    """Create or update a budget for (user_id, category, month)."""
    now_iso = datetime.now(timezone.utc).isoformat()

    if use_supabase:
        payload = {
            "user_id": user_id,
            "category": category,
            "amount_ils": amount_ils,
            "month": month,
            "updated_at": now_iso,
        }
        response = (
            supabase.table("budgets")
            .upsert(payload, on_conflict="user_id,category,month")
            .execute()
        )
        rows = response.data or []
        if rows:
            return rows[0]
        # Fallback: fetch the record
        fetch = (
            supabase.table("budgets")
            .select("*")
            .eq("user_id", user_id)
            .eq("category", category)
            .eq("month", month)
            .limit(1)
            .execute()
        )
        return (fetch.data or [{}])[0]

    # MongoDB path
    doc = {
        "user_id": user_id,
        "category": category,
        "amount_ils": amount_ils,
        "month": month,
        "updated_at": now_iso,
    }
    result = await db["budgets"].update_one(
        {"user_id": user_id, "category": category, "month": month},
        {"$set": doc, "$setOnInsert": {"created_at": now_iso}},
        upsert=True,
    )
    saved = await db["budgets"].find_one(
        {"user_id": user_id, "category": category, "month": month}
    )
    if saved:
        saved["id"] = str(saved.pop("_id"))
    return saved or doc


async def db_delete_budget(budget_id: str, user_id: str) -> int:
    """Delete a budget by id, scoped to user_id. Returns deleted count."""
    if use_supabase:
        response = (
            supabase.table("budgets")
            .delete()
            .eq("id", budget_id)
            .eq("user_id", user_id)
            .execute()
        )
        return len(response.data or [])

    from bson import ObjectId
    try:
        oid = ObjectId(budget_id)
    except Exception:
        return 0
    result = await db["budgets"].delete_one({"_id": oid, "user_id": user_id})
    return result.deleted_count


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

import hmac
import httpx

from integrations.israel_banks.connector import SUPPORTED_BANKS
from integrations.israel_banks.crypto import encrypt_credentials, decrypt_credentials
from integrations.israel_banks.normalizer import (
    normalize_transaction,
    normalize_account,
    normalize_scraper_account as _normalize_scraper_account,
    normalize_scraper_transaction as _normalize_scraper_transaction,
)
from integrations.israel_banks.scheduler import BankSyncScheduler


def _get_scraper_service_url() -> str:
    """Return the base URL of the Node.js scraper microservice.

    Priority:
    1. SCRAPER_SERVICE_URL env var (explicit override)
    2. https://{VERCEL_URL} (Vercel auto-injects this in production)
    3. http://localhost:3001 (local development fallback)
    """
    explicit = _env("SCRAPER_SERVICE_URL")
    if explicit:
        return explicit.rstrip("/")
    vercel_url = os.environ.get("VERCEL_URL", "").strip()
    if vercel_url:
        return f"https://{vercel_url}"
    return "http://localhost:3001"


def _get_internal_secret() -> str:
    secret = _env("INTERNAL_API_SECRET")
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="INTERNAL_API_SECRET is not configured. Bank integration is unavailable.",
        )
    return secret


async def _call_scraper(endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Call a Node.js scraper microservice endpoint.

    Parameters
    ----------
    endpoint:
        Path segment after ``/api/scraper/israel/``, e.g. ``"login"``.
    payload:
        JSON body to send.

    Returns
    -------
    Parsed JSON response dict.

    Raises
    ------
    HTTPException on HTTP/connection errors or non-2xx responses.
    """
    base_url = _get_scraper_service_url()
    url = f"{base_url}/api/scraper/israel/{endpoint}"
    secret = _get_internal_secret()

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={"X-Internal-Secret": secret, "Content-Type": "application/json"},
            )
    except httpx.ConnectError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Scraper service unreachable at {url}: {exc}",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Scraper service timed out. Bank scraping can take up to 60 seconds.",
        )

    if resp.status_code == 403:
        raise HTTPException(status_code=500, detail="Internal secret mismatch. Check INTERNAL_API_SECRET.")
    if resp.status_code not in (200, 201):
        try:
            detail = resp.json().get("error", resp.text)
        except Exception:
            detail = resp.text
        raise HTTPException(status_code=resp.status_code, detail=f"Scraper error: {detail}")

    return resp.json()

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
    # Simple username/password (backward-compatible with existing frontend)
    username: Optional[str] = None
    password: Optional[str] = None
    # Extended credentials dict (takes precedence; required for banks with
    # non-standard login fields such as discount/isracard/amex)
    credentials: Optional[Dict[str, str]] = None


class BankOtpRequest(BaseModel):
    bank_id: str
    otp: str


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
    """Return metadata for all supported Israeli banks and credit-card providers."""
    return [{"id": bank_id, **meta} for bank_id, meta in SUPPORTED_BANKS.items()]


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
    """Initiate a connection to an Israeli bank via the scraper microservice."""
    user_id = await _resolve_user_id(x_user_id, authorization)

    if payload.bank_id not in SUPPORTED_BANKS:
        raise HTTPException(status_code=400, detail=f"Unsupported bank: {payload.bank_id}")

    # Build credentials dict from request fields
    if payload.credentials:
        credentials = payload.credentials
    else:
        # Backward-compatible: simple username/password
        if not payload.password:
            raise HTTPException(status_code=400, detail="password is required")
        credentials = {}
        if payload.username:
            credentials["username"] = payload.username
            # hapoalim uses `userCode` rather than `username`
            if payload.bank_id == "hapoalim":
                credentials["userCode"] = payload.username
        credentials["password"] = payload.password

    bank_meta = SUPPORTED_BANKS[payload.bank_id]

    # Call the scraper microservice
    scraper_result = await _call_scraper("login", {
        "company_id": payload.bank_id,
        "credentials": credentials,
    })

    status = scraper_result.get("status")
    if status == "otp_required":
        # Return 202 so the frontend knows to collect OTP
        return {
            "status": "otp_required",
            "bank_id": payload.bank_id,
            "message": scraper_result.get("message", "OTP required. Call /api/banks/israel/otp with the code."),
        }

    if status == "error":
        raise HTTPException(
            status_code=502,
            detail=f"Bank login failed: {scraper_result.get('errorMessage', scraper_result.get('errorType', 'Unknown error'))}",
        )

    raw_accounts = scraper_result.get("accounts", [])
    now_iso = datetime.now(timezone.utc).isoformat()
    conn_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{user_id}:{payload.bank_id}"))

    normalized_accounts = [
        _normalize_scraper_account(acc, payload.bank_id) for acc in raw_accounts
    ]

    conn_record = {
        "id": conn_id,
        "user_id": user_id,
        "bank_id": payload.bank_id,
        "bank_name": bank_meta["name"],
        "connector_type": "israeli-bank-scrapers",
        "status": "connected",
        "encrypted_credentials": encrypt_credentials(credentials),
        "accounts": normalized_accounts,
        "last_synced_at": None,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    await db_upsert_bank_connection(conn_record)
    return {k: v for k, v in conn_record.items() if k != "encrypted_credentials"}


@api_router.post("/banks/israel/otp")
async def complete_bank_otp(
    payload: BankOtpRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Complete an OTP-required bank connection.

    The caller must have previously called /banks/israel/connect and received
    status="otp_required".  They now provide the OTP code received via SMS/app.
    The stored credentials (encrypted) are retrieved, combined with the OTP,
    and passed to the scraper service to complete the login.
    """
    user_id = await _resolve_user_id(x_user_id, authorization)

    if payload.bank_id not in SUPPORTED_BANKS:
        raise HTTPException(status_code=400, detail=f"Unsupported bank: {payload.bank_id}")

    conn_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{user_id}:{payload.bank_id}"))
    connections = await db_get_bank_connections(user_id)
    conn = next(
        (c for c in connections if c.get("id") == conn_id and c.get("bank_id") == payload.bank_id),
        None,
    )

    if not conn or not conn.get("encrypted_credentials"):
        raise HTTPException(
            status_code=404,
            detail="No pending connection found. Please call /banks/israel/connect first.",
        )

    try:
        credentials = decrypt_credentials(conn["encrypted_credentials"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to decrypt credentials: {exc}")

    # Add OTP to credentials
    credentials["otp"] = payload.otp

    scraper_result = await _call_scraper("otp", {
        "company_id": payload.bank_id,
        "credentials": credentials,
    })

    status = scraper_result.get("status")
    if status == "error":
        raise HTTPException(
            status_code=502,
            detail=f"OTP verification failed: {scraper_result.get('errorMessage', 'Unknown error')}",
        )

    raw_accounts = scraper_result.get("accounts", [])
    now_iso = datetime.now(timezone.utc).isoformat()
    bank_meta = SUPPORTED_BANKS[payload.bank_id]

    normalized_accounts = [
        _normalize_scraper_account(acc, payload.bank_id) for acc in raw_accounts
    ]

    # Remove OTP from stored credentials (don't persist short-lived OTP codes)
    credentials.pop("otp", None)

    conn.update({
        "bank_name": bank_meta["name"],
        "connector_type": "israeli-bank-scrapers",
        "status": "connected",
        "encrypted_credentials": encrypt_credentials(credentials),
        "accounts": normalized_accounts,
        "updated_at": now_iso,
    })

    await db_upsert_bank_connection(conn)
    return {k: v for k, v in conn.items() if k != "encrypted_credentials"}


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
        if conn.get("connector_type") == "woob":
            continue  # handled by woob endpoints
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

    if bank_id not in SUPPORTED_BANKS:
        raise HTTPException(status_code=400, detail=f"Unsupported bank: {bank_id}")

    try:
        creds = decrypt_credentials(conn["encrypted_credentials"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to decrypt credentials: {exc}")

    last_synced_at = conn.get("last_synced_at")
    from_date = (
        datetime.fromisoformat(last_synced_at).date().isoformat()
        if last_synced_at
        else (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    )

    try:
        scraper_result = await _call_scraper("transactions", {
            "company_id": bank_id,
            "credentials": creds,
            "start_date": from_date,
        })
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Sync failed: {exc}")

    raw_accounts = scraper_result.get("accounts", [])
    normalized_accounts = [_normalize_scraper_account(acc, bank_id) for acc in raw_accounts]

    all_txs: List[Dict[str, Any]] = []
    for account in raw_accounts:
        acct_num = account.get("accountNumber", "unknown")
        for txn in account.get("txns", []):
            normalized = _normalize_scraper_transaction(txn, acct_num, bank_id, user_id)
            if normalized:
                all_txs.append(normalized)

    if all_txs:
        await db_upsert_transactions_by_external_id(all_txs)

    now_iso = datetime.now(timezone.utc).isoformat()
    conn["last_synced_at"] = now_iso
    conn["updated_at"] = now_iso
    conn["accounts"] = normalized_accounts
    await db_upsert_bank_connection(conn)

    return BankSyncResponse(
        bank_id=bank_id,
        account_count=len(raw_accounts),
        transaction_count=len(all_txs),
        synced_at=now_iso,
    )


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

    # ── Israeli bank connections (via Node.js scraper microservice) ───────
    try:
        israel_connections = await db_get_all_active_bank_connections()
    except Exception as exc:
        results["errors"].append(f"Failed to load Israeli connections: {exc}")
        israel_connections = []

    for conn in israel_connections:
        if conn.get("connector_type") == "woob":
            continue  # handled below
        bank_id = conn.get("bank_id", "")
        user_id = conn.get("user_id", "")
        if bank_id not in SUPPORTED_BANKS:
            continue
        try:
            creds = decrypt_credentials(conn["encrypted_credentials"])

            last_synced_at = conn.get("last_synced_at")
            from_date = (
                datetime.fromisoformat(last_synced_at).date().isoformat()
                if last_synced_at
                else (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
            )

            scraper_result = await _call_scraper("transactions", {
                "company_id": bank_id,
                "credentials": creds,
                "start_date": from_date,
            })

            raw_accounts = scraper_result.get("accounts", [])
            all_txs: List[Dict[str, Any]] = []
            for account in raw_accounts:
                acct_num = account.get("accountNumber", "unknown")
                for txn in account.get("txns", []):
                    normalized = _normalize_scraper_transaction(txn, acct_num, bank_id, user_id)
                    if normalized:
                        all_txs.append(normalized)

            if all_txs:
                await db_upsert_transactions_by_external_id(all_txs)

            now_iso = datetime.now(timezone.utc).isoformat()
            conn["last_synced_at"] = now_iso
            conn["updated_at"] = now_iso
            conn["accounts"] = [_normalize_scraper_account(acc, bank_id) for acc in raw_accounts]
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
        call_scraper=_call_scraper,
        sync_interval_hours=int(os.environ.get("ISRAEL_BANKS_SYNC_HOURS", "6")),
    )
    _scheduler.start()


# ── BUDGETS ──────────────────────────────────────────────────────────────────

@api_router.get("/budgets/summary")
async def budgets_summary(
    request: Request,
    month: Optional[str] = None,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """
    For each budget this month, return how much was spent vs budgeted.
    Query param: month (YYYY-MM, default = current month)
    """
    user_id = await _resolve_user_id(x_user_id, authorization)
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")

    budgets = await db_list_budgets(user_id, month=month)
    transactions = await db_get_transactions(user_id=user_id, limit=5000)

    # Sum expenses by category for the given month
    spending: Dict[str, float] = {}
    for t in transactions:
        if t.get("type") != "expense":
            continue
        date_str = t.get("date", "")
        if not date_str.startswith(month):
            continue
        cat = t.get("category", "")
        spending[cat] = spending.get(cat, 0.0) + float(t.get("amount", 0))

    result = []
    for b in budgets:
        budget_amount = float(b.get("amount_ils", 0))
        cat = b.get("category", "")
        spent = spending.get(cat, 0.0)
        remaining = budget_amount - spent
        percentage = (spent / budget_amount * 100) if budget_amount > 0 else 0.0
        if percentage > 100:
            status = "exceeded"
        elif percentage > 80:
            status = "warning"
        else:
            status = "ok"
        result.append({
            "id": b.get("id", ""),
            "category": cat,
            "budget_amount": budget_amount,
            "spent_amount": round(spent, 2),
            "remaining": round(remaining, 2),
            "percentage": round(percentage, 1),
            "status": status,
            "month": b.get("month", month),
        })

    result.sort(key=lambda x: x["percentage"], reverse=True)
    return result


@api_router.get("/budgets")
async def list_budgets(
    request: Request,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """List all budgets for the current user."""
    user_id = await _resolve_user_id(x_user_id, authorization)
    return await db_list_budgets(user_id)


@api_router.post("/budgets")
async def upsert_budget(
    request: Request,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Create or update a budget for a category+month combination."""
    user_id = await _resolve_user_id(x_user_id, authorization)
    body = await request.json()
    category = body.get("category", "").strip()
    amount_ils = body.get("amount_ils")
    month = body.get("month", "").strip()

    if not category:
        raise HTTPException(status_code=422, detail="category is required")
    if amount_ils is None or float(amount_ils) <= 0:
        raise HTTPException(status_code=422, detail="amount_ils must be a positive number")
    if not month:
        raise HTTPException(status_code=422, detail="month is required (YYYY-MM)")

    saved = await db_upsert_budget(user_id, category, float(amount_ils), month)
    return saved


@api_router.delete("/budgets/{budget_id}")
async def delete_budget(
    budget_id: str,
    request: Request,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Delete a budget by ID."""
    user_id = await _resolve_user_id(x_user_id, authorization)
    deleted = await db_delete_budget(budget_id, user_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Budget not found")
    return {"message": "Budget deleted"}


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
