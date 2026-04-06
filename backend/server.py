from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from supabase import create_client
import os
import logging
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

# Import insights engine
from insights_engine import generate_insights

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


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


async def db_get_transactions(limit: int = 1000) -> List[Dict[str, Any]]:
    if use_supabase:
        response = (
            supabase.table("transactions")
            .select("id,date,amount,category,merchant,type")
            .order("date", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []

    return await db.transactions.find({}, {"_id": 0}).to_list(limit)


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


async def db_delete_transaction(transaction_id: str) -> int:
    if use_supabase:
        response = supabase.table("transactions").delete().eq("id", transaction_id).execute()
        return len(response.data or [])

    result = await db.transactions.delete_one({"id": transaction_id})
    return result.deleted_count


async def db_count_transactions() -> int:
    if use_supabase:
        response = supabase.table("transactions").select("id", count="exact").limit(1).execute()
        return response.count or 0

    return await db.transactions.count_documents({})


async def db_clear_transactions() -> None:
    if use_supabase:
        supabase.table("transactions").delete().neq("id", "") .execute()
        return

    await db.transactions.delete_many({})

# Define Models
class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    amount: float
    category: str
    merchant: str
    type: str = "expense"

class TransactionCreate(BaseModel):
    date: str
    amount: float
    category: str
    merchant: str
    type: str = "expense"

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
            "amount": 5000.00,
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
            amount = round(random.uniform(min_amt, max_amt), 2)
            
            transactions.append({
                "id": str(uuid.uuid4()),
                "date": date.strftime("%Y-%m-%d"),
                "amount": amount,
                "category": category,
                "merchant": merchant,
                "type": "expense"
            })
    
    return transactions

@api_router.get("/")
async def root():
    return {"message": "FlowIQ API - Your Smart CFO"}

@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions():
    transactions = await db_get_transactions(1000)
    return transactions

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction: TransactionCreate):
    trans_dict = transaction.model_dump()
    trans_obj = Transaction(**trans_dict)
    doc = trans_obj.model_dump()
    await db_insert_transaction(doc)
    return trans_obj

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str):
    deleted_count = await db_delete_transaction(transaction_id)
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted"}

@api_router.post("/seed-demo-data")
async def seed_demo_data():
    """Seed the database with demo data"""
    count = await db_count_transactions()
    if count > 0:
        return {"message": "Demo data already exists", "count": count}
    
    demo_data = generate_demo_data()
    await db_insert_transactions(demo_data)
    return {"message": "Demo data seeded successfully", "count": len(demo_data)}

@api_router.delete("/clear-data")
async def clear_data():
    """Clear all transaction data"""
    await db_clear_transactions()
    return {"message": "All data cleared"}

@api_router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard():
    transactions = await db_get_transactions(1000)
    
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
async def get_advanced_insights():
    """Get advanced AI-powered insights with personality and health score"""
    transactions = await db_get_transactions(1000)
    
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
async def get_insights():
    """Legacy insights endpoint - returns simplified format"""
    advanced = await get_advanced_insights()
    
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
async def get_cashflow_prediction():
    transactions = await db_get_transactions(1000)
    
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
async def upload_csv(file: UploadFile = File(...)):
    """Upload and parse a bank statement CSV file"""
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
                        "type": trans_type
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

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()
