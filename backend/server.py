from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import csv
import io
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    amount: float
    category: str
    merchant: str
    type: str = "expense"  # expense or income

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

class Insight(BaseModel):
    id: str
    type: str  # warning, tip, info, positive
    title: str
    description: str
    icon: str

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
    transactions = await db.transactions.find({}, {"_id": 0}).to_list(1000)
    return transactions

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction: TransactionCreate):
    trans_dict = transaction.model_dump()
    trans_obj = Transaction(**trans_dict)
    doc = trans_obj.model_dump()
    await db.transactions.insert_one(doc)
    return trans_obj

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str):
    result = await db.transactions.delete_one({"id": transaction_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted"}

@api_router.post("/seed-demo-data")
async def seed_demo_data():
    """Seed the database with demo data"""
    # Check if data already exists
    count = await db.transactions.count_documents({})
    if count > 0:
        return {"message": "Demo data already exists", "count": count}
    
    demo_data = generate_demo_data()
    await db.transactions.insert_many(demo_data)
    return {"message": "Demo data seeded successfully", "count": len(demo_data)}

@api_router.delete("/clear-data")
async def clear_data():
    """Clear all transaction data"""
    await db.transactions.delete_many({})
    return {"message": "All data cleared"}

@api_router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard():
    transactions = await db.transactions.find({}, {"_id": 0}).to_list(1000)
    
    if not transactions:
        return DashboardSummary(
            total_balance=0,
            total_income=0,
            total_expenses=0,
            monthly_spending=0,
            categories={},
            spending_by_month=[]
        )
    
    # Calculate totals
    total_income = sum(t["amount"] for t in transactions if t.get("type") == "income")
    total_expenses = sum(t["amount"] for t in transactions if t.get("type") == "expense")
    total_balance = total_income - total_expenses
    
    # Current month spending
    today = datetime.now(timezone.utc)
    current_month = today.strftime("%Y-%m")
    monthly_spending = sum(
        t["amount"] for t in transactions 
        if t.get("type") == "expense" and t["date"].startswith(current_month)
    )
    
    # Categories breakdown
    categories = {}
    for t in transactions:
        if t.get("type") == "expense":
            cat = t["category"]
            categories[cat] = categories.get(cat, 0) + t["amount"]
    
    # Round category values
    categories = {k: round(v, 2) for k, v in categories.items()}
    
    # Spending by month (last 6 months)
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

@api_router.get("/insights", response_model=List[Insight])
async def get_insights():
    transactions = await db.transactions.find({}, {"_id": 0}).to_list(1000)
    insights = []
    
    if not transactions:
        return [Insight(
            id=str(uuid.uuid4()),
            type="info",
            title="No Data Yet",
            description="Upload your bank statement to get personalized insights.",
            icon="upload"
        )]
    
    today = datetime.now(timezone.utc)
    current_month = today.strftime("%Y-%m")
    last_month = (today - timedelta(days=30)).strftime("%Y-%m")
    
    # Calculate current and last month expenses
    current_expenses = [t for t in transactions if t.get("type") == "expense" and t["date"].startswith(current_month)]
    last_expenses = [t for t in transactions if t.get("type") == "expense" and t["date"].startswith(last_month)]
    
    current_total = sum(t["amount"] for t in current_expenses)
    last_total = sum(t["amount"] for t in last_expenses)
    
    # Insight 1: Month over month comparison
    if last_total > 0:
        change = ((current_total - last_total) / last_total) * 100
        if change > 0:
            insights.append(Insight(
                id=str(uuid.uuid4()),
                type="warning",
                title="Spending Increased",
                description=f"You've spent {abs(change):.0f}% more than last month. Consider reviewing your expenses.",
                icon="trending-up"
            ))
        else:
            insights.append(Insight(
                id=str(uuid.uuid4()),
                type="positive",
                title="Great Job!",
                description=f"You've spent {abs(change):.0f}% less than last month. Keep it up!",
                icon="trending-down"
            ))
    
    # Insight 2: Subscription count
    subscriptions = [t for t in transactions if t["category"] == "Subscriptions"]
    unique_subs = len(set(t["merchant"] for t in subscriptions))
    if unique_subs > 0:
        sub_total = sum(t["amount"] for t in subscriptions if t["date"].startswith(current_month))
        insights.append(Insight(
            id=str(uuid.uuid4()),
            type="info",
            title=f"You Have {unique_subs} Active Subscriptions",
            description=f"Your subscriptions cost ${sub_total:.2f} this month. Review if you're using all of them.",
            icon="credit-card"
        ))
    
    # Insight 3: Top spending category
    categories = {}
    for t in transactions:
        if t.get("type") == "expense":
            cat = t["category"]
            categories[cat] = categories.get(cat, 0) + t["amount"]
    
    if categories:
        top_category = max(categories, key=categories.get)
        insights.append(Insight(
            id=str(uuid.uuid4()),
            type="info",
            title=f"Top Spending: {top_category}",
            description=f"You've spent ${categories[top_category]:.2f} on {top_category}. This is your biggest expense category.",
            icon="pie-chart"
        ))
    
    # Insight 4: Savings tip
    if "Food & Dining" in categories and categories["Food & Dining"] > 300:
        potential_savings = categories["Food & Dining"] * 0.2
        insights.append(Insight(
            id=str(uuid.uuid4()),
            type="tip",
            title="Savings Opportunity",
            description=f"You could save ${potential_savings:.2f} by reducing dining out by 20%.",
            icon="lightbulb"
        ))
    
    # Insight 5: Weekend spending
    weekend_spending = sum(
        t["amount"] for t in transactions 
        if t.get("type") == "expense" and 
        datetime.strptime(t["date"].strip(), "%Y-%m-%d").weekday() >= 5
    )
    weekday_spending = sum(
        t["amount"] for t in transactions 
        if t.get("type") == "expense" and 
        datetime.strptime(t["date"].strip(), "%Y-%m-%d").weekday() < 5
    )
    
    if weekday_spending > 0:
        weekend_ratio = weekend_spending / (weekend_spending + weekday_spending) * 100
        if weekend_ratio > 40:
            insights.append(Insight(
                id=str(uuid.uuid4()),
                type="warning",
                title="High Weekend Spending",
                description=f"{weekend_ratio:.0f}% of your spending happens on weekends. Plan weekend activities to save more.",
                icon="calendar"
            ))
    
    return insights[:5]  # Return top 5 insights

@api_router.get("/cashflow-prediction", response_model=CashflowPrediction)
async def get_cashflow_prediction():
    transactions = await db.transactions.find({}, {"_id": 0}).to_list(1000)
    
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
    
    # Calculate current balance
    total_income = sum(t["amount"] for t in transactions if t.get("type") == "income")
    total_expenses = sum(t["amount"] for t in transactions if t.get("type") == "expense")
    current_balance = total_income - total_expenses
    
    # Calculate daily average spending (last 30 days)
    thirty_days_ago = today - timedelta(days=30)
    recent_expenses = [
        t for t in transactions 
        if t.get("type") == "expense" and 
        datetime.strptime(t["date"].strip(), "%Y-%m-%d") >= thirty_days_ago.replace(tzinfo=None)
    ]
    
    daily_average = sum(t["amount"] for t in recent_expenses) / 30 if recent_expenses else 0
    
    # Days remaining in month
    import calendar
    _, days_in_month = calendar.monthrange(today.year, today.month)
    days_remaining = days_in_month - today.day
    
    # Predicted spending for rest of month
    predicted_spending = daily_average * days_remaining
    predicted_end_balance = current_balance - predicted_spending
    
    # Determine warning
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
            # Try to map common CSV column names
            date = row.get('date') or row.get('Date') or row.get('DATE') or row.get('Transaction Date')
            amount = row.get('amount') or row.get('Amount') or row.get('AMOUNT') or row.get('Debit')
            category = row.get('category') or row.get('Category') or row.get('CATEGORY') or "Uncategorized"
            merchant = row.get('merchant') or row.get('Merchant') or row.get('Description') or row.get('DESCRIPTION') or "Unknown"
            trans_type = row.get('type') or row.get('Type') or "expense"
            
            if date and amount:
                try:
                    # Parse amount (handle negative values and currency symbols)
                    amount_str = str(amount).replace('$', '').replace(',', '').strip()
                    amount_val = abs(float(amount_str))
                    
                    # Determine if expense or income
                    if float(amount_str) > 0 and trans_type.lower() not in ['expense', 'debit']:
                        trans_type = "income"
                    else:
                        trans_type = "expense"
                    
                    transactions.append({
                        "id": str(uuid.uuid4()),
                        "date": date,
                        "amount": amount_val,
                        "category": category,
                        "merchant": merchant[:100],  # Limit merchant name length
                        "type": trans_type
                    })
                except ValueError:
                    continue  # Skip rows with invalid amounts
        
        if not transactions:
            raise HTTPException(status_code=400, detail="No valid transactions found in CSV")
        
        # Insert transactions
        await db.transactions.insert_many(transactions)
        
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
    client.close()
