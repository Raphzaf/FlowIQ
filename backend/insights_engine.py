"""
FlowIQ Advanced Insights Engine
Transforms transaction data into actionable financial intelligence
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import statistics


class InsightsEngine:
    """Advanced financial insights generator"""
    
    def __init__(self, transactions: List[Dict]):
        self.transactions = transactions
        self.today = datetime.now(timezone.utc)
        self.current_month = self.today.strftime("%Y-%m")
        self.last_month = (self.today - timedelta(days=30)).strftime("%Y-%m")
        
        # Pre-compute common aggregations
        self._precompute()
    
    def _precompute(self):
        """Pre-compute common data aggregations"""
        self.expenses = [t for t in self.transactions if t.get("type") == "expense"]
        self.incomes = [t for t in self.transactions if t.get("type") == "income"]
        
        # Current month expenses
        self.current_month_expenses = [
            t for t in self.expenses 
            if t["date"].startswith(self.current_month)
        ]
        
        # Last month expenses
        self.last_month_expenses = [
            t for t in self.expenses 
            if t["date"].startswith(self.last_month)
        ]
        
        # Category totals (current month)
        self.category_totals = defaultdict(float)
        for t in self.current_month_expenses:
            self.category_totals[t["category"]] += t["amount"]
        
        # Category totals (last month)
        self.last_month_category_totals = defaultdict(float)
        for t in self.last_month_expenses:
            self.last_month_category_totals[t["category"]] += t["amount"]
        
        # Total spending
        self.current_month_total = sum(t["amount"] for t in self.current_month_expenses)
        self.last_month_total = sum(t["amount"] for t in self.last_month_expenses)
        
        # Total income
        self.total_income = sum(t["amount"] for t in self.incomes)
        self.total_expenses = sum(t["amount"] for t in self.expenses)
        self.current_balance = self.total_income - self.total_expenses
    
    def _parse_date(self, date_str: str) -> datetime:
        """Parse date string to datetime"""
        return datetime.strptime(date_str, "%Y-%m-%d")
    
    def generate_all_insights(self) -> Dict[str, Any]:
        """Generate all insights"""
        insights = []
        
        # Generate each insight type
        spending_trend = self.spending_trend_insight()
        if spending_trend:
            insights.append(spending_trend)
        
        category_dominance = self.category_dominance_insight()
        if category_dominance:
            insights.append(category_dominance)
        
        subscription = self.subscription_detection_insight()
        if subscription:
            insights.append(subscription)
        
        cashflow = self.cashflow_warning_insight()
        if cashflow:
            insights.append(cashflow)
        
        weekend = self.weekend_spending_insight()
        if weekend:
            insights.append(weekend)
        
        micro = self.micro_spending_insight()
        if micro:
            insights.append(micro)
        
        projection = self.projection_insight()
        if projection:
            insights.append(projection)
        
        # Generate spending personality
        personality = self.spending_personality()
        
        # Generate financial health score
        health_score = self.financial_health_score()
        
        return {
            "insights": insights,
            "personality": personality,
            "health_score": health_score
        }
    
    def spending_trend_insight(self) -> Optional[Dict]:
        """Detect month-over-month spending change with cause analysis"""
        if self.last_month_total == 0:
            return None
        
        change_pct = ((self.current_month_total - self.last_month_total) / self.last_month_total) * 100
        change_amount = self.current_month_total - self.last_month_total
        
        # Find the category driving the change
        category_changes = {}
        for cat, amount in self.category_totals.items():
            last_amount = self.last_month_category_totals.get(cat, 0)
            if last_amount > 0:
                cat_change = ((amount - last_amount) / last_amount) * 100
                category_changes[cat] = {
                    "change_pct": cat_change,
                    "change_amount": amount - last_amount,
                    "current": amount
                }
            elif amount > 0:
                category_changes[cat] = {
                    "change_pct": 100,
                    "change_amount": amount,
                    "current": amount
                }
        
        # Find biggest driver
        driver = None
        driver_change = 0
        for cat, data in category_changes.items():
            if data["change_amount"] > driver_change:
                driver = cat
                driver_change = data["change_amount"]
        
        # Calculate projected overspend
        days_passed = self.today.day
        daily_rate = self.current_month_total / max(days_passed, 1)
        import calendar
        _, days_in_month = calendar.monthrange(self.today.year, self.today.month)
        days_remaining = days_in_month - days_passed
        projected_total = self.current_month_total + (daily_rate * days_remaining)
        projected_overspend = projected_total - self.last_month_total
        
        if abs(change_pct) < 5:
            return {
                "id": "spending_trend",
                "type": "positive",
                "icon": "trending-flat",
                "title": "Spending On Track",
                "headline": "Your spending is stable this month",
                "description": f"You've spent ${self.current_month_total:,.0f} so far — similar to last month. Great consistency!",
                "data": {
                    "change_pct": round(change_pct, 1),
                    "current_total": round(self.current_month_total, 2),
                    "last_total": round(self.last_month_total, 2)
                },
                "priority": 2
            }
        elif change_pct > 0:
            driver_text = f" — mainly driven by {driver} (+{category_changes[driver]['change_pct']:.0f}%)" if driver else ""
            consequence = f" If this continues, you could overspend by ${projected_overspend:,.0f} by month-end." if projected_overspend > 50 else ""
            
            return {
                "id": "spending_trend",
                "type": "warning",
                "icon": "trending-up",
                "title": "Spending Increased",
                "headline": f"Your spending increased by {change_pct:.0f}% this month",
                "description": f"You've spent ${self.current_month_total:,.0f} vs ${self.last_month_total:,.0f} last month{driver_text}.{consequence}",
                "data": {
                    "change_pct": round(change_pct, 1),
                    "change_amount": round(change_amount, 2),
                    "driver_category": driver,
                    "driver_change_pct": round(category_changes[driver]["change_pct"], 1) if driver else 0,
                    "projected_overspend": round(projected_overspend, 2)
                },
                "priority": 1
            }
        else:
            return {
                "id": "spending_trend",
                "type": "positive",
                "icon": "trending-down",
                "title": "Great Progress!",
                "headline": f"You've cut spending by {abs(change_pct):.0f}% this month",
                "description": f"You've spent ${self.current_month_total:,.0f} vs ${self.last_month_total:,.0f} last month. Keep this momentum going!",
                "data": {
                    "change_pct": round(change_pct, 1),
                    "savings": round(abs(change_amount), 2)
                },
                "priority": 2
            }
    
    def category_dominance_insight(self) -> Optional[Dict]:
        """Find largest spending category with savings projection"""
        if not self.category_totals:
            return None
        
        # Sort categories by amount
        sorted_cats = sorted(self.category_totals.items(), key=lambda x: x[1], reverse=True)
        top_cat, top_amount = sorted_cats[0]
        
        # Calculate percentage
        total = sum(self.category_totals.values())
        if total == 0:
            return None
        
        pct = (top_amount / total) * 100
        
        # Calculate potential savings (15% reduction)
        potential_savings = top_amount * 0.15
        yearly_savings = potential_savings * 12
        
        severity = "warning" if pct > 40 else "info"
        
        return {
            "id": "category_dominance",
            "type": severity,
            "icon": "pie-chart",
            "title": f"Top Category: {top_cat}",
            "headline": f"{top_cat} is {pct:.0f}% of your spending",
            "description": f"You've spent ${top_amount:,.0f} on {top_cat} this month. Reducing it by just 15% could save you ~${potential_savings:,.0f}/month (${yearly_savings:,.0f}/year).",
            "data": {
                "category": top_cat,
                "amount": round(top_amount, 2),
                "percentage": round(pct, 1),
                "potential_monthly_savings": round(potential_savings, 2),
                "potential_yearly_savings": round(yearly_savings, 2),
                "all_categories": {k: round(v, 2) for k, v in sorted_cats[:5]}
            },
            "priority": 2
        }
    
    def subscription_detection_insight(self) -> Optional[Dict]:
        """Detect recurring subscriptions"""
        # Group transactions by merchant
        merchant_transactions = defaultdict(list)
        for t in self.expenses:
            merchant_transactions[t["merchant"]].append(t)
        
        subscriptions = []
        
        for merchant, trans in merchant_transactions.items():
            if len(trans) < 2:
                continue
            
            # Sort by date
            trans.sort(key=lambda x: x["date"])
            
            # Check for similar amounts and regular intervals
            amounts = [t["amount"] for t in trans]
            avg_amount = statistics.mean(amounts)
            
            # Check if amounts are similar (within 20%)
            amount_variance = all(abs(a - avg_amount) / avg_amount < 0.2 for a in amounts) if avg_amount > 0 else False
            
            if amount_variance and len(trans) >= 2:
                # Check interval (roughly monthly - 25-35 days)
                dates = [self._parse_date(t["date"]) for t in trans]
                intervals = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
                
                if intervals and all(20 <= i <= 40 for i in intervals):
                    # Check last usage
                    last_date = dates[-1]
                    days_since_last = (self.today.replace(tzinfo=None) - last_date).days
                    
                    subscriptions.append({
                        "merchant": merchant,
                        "amount": round(avg_amount, 2),
                        "frequency": "monthly",
                        "days_since_last": days_since_last,
                        "potentially_unused": days_since_last > 35
                    })
        
        if not subscriptions:
            # Check for known subscription merchants
            sub_keywords = ["netflix", "spotify", "hulu", "apple", "adobe", "amazon prime", 
                          "hbo", "disney", "notion", "dropbox", "gym", "membership"]
            
            for merchant, trans in merchant_transactions.items():
                merchant_lower = merchant.lower()
                if any(kw in merchant_lower for kw in sub_keywords):
                    # Get most recent
                    recent = max(trans, key=lambda x: x["date"])
                    last_date = self._parse_date(recent["date"])
                    days_since = (self.today.replace(tzinfo=None) - last_date).days
                    
                    subscriptions.append({
                        "merchant": merchant,
                        "amount": round(recent["amount"], 2),
                        "frequency": "monthly",
                        "days_since_last": days_since,
                        "potentially_unused": days_since > 35
                    })
        
        if not subscriptions:
            return None
        
        total_monthly = sum(s["amount"] for s in subscriptions)
        unused_count = sum(1 for s in subscriptions if s["potentially_unused"])
        unused_total = sum(s["amount"] for s in subscriptions if s["potentially_unused"])
        
        unused_text = ""
        if unused_count > 0:
            unused_text = f" {unused_count} subscription{'s' if unused_count > 1 else ''} may be unused — you could save ${unused_total:,.0f}/month by reviewing them."
        
        return {
            "id": "subscriptions",
            "type": "info" if unused_count == 0 else "warning",
            "icon": "credit-card",
            "title": f"{len(subscriptions)} Active Subscription{'s' if len(subscriptions) > 1 else ''}",
            "headline": f"Subscriptions cost you ${total_monthly:,.0f}/month",
            "description": f"You have {len(subscriptions)} recurring subscription{'s' if len(subscriptions) > 1 else ''} totaling ${total_monthly:,.0f}/month (${total_monthly * 12:,.0f}/year).{unused_text}",
            "data": {
                "count": len(subscriptions),
                "total_monthly": round(total_monthly, 2),
                "total_yearly": round(total_monthly * 12, 2),
                "unused_count": unused_count,
                "potential_savings": round(unused_total, 2),
                "subscriptions": subscriptions[:5]
            },
            "priority": 2 if unused_count == 0 else 1
        }
    
    def cashflow_warning_insight(self) -> Optional[Dict]:
        """Predict end-of-month balance with warnings"""
        if not self.current_month_expenses:
            return None
        
        # Calculate daily spending rate
        days_passed = max(self.today.day, 1)
        daily_rate = self.current_month_total / days_passed
        
        # Days remaining
        import calendar
        _, days_in_month = calendar.monthrange(self.today.year, self.today.month)
        days_remaining = days_in_month - self.today.day
        
        # Projected end balance
        projected_spending = daily_rate * days_remaining
        projected_end_balance = self.current_balance - projected_spending
        
        # Calculate days until zero (if negative trajectory)
        days_until_zero = None
        if daily_rate > 0 and self.current_balance > 0:
            days_until_zero = int(self.current_balance / daily_rate)
        
        if projected_end_balance < 0 and days_until_zero is not None:
            days_until_zero_safe = days_until_zero if days_until_zero else days_remaining
            return {
                "id": "cashflow_warning",
                "type": "critical",
                "icon": "alert-triangle",
                "title": "Cashflow Alert",
                "headline": f"Balance may go negative in {days_until_zero_safe} days",
                "description": f"At your current pace (${daily_rate:,.0f}/day), your balance could drop below $0 by day {min(self.today.day + days_until_zero_safe, days_in_month)}. Consider reducing discretionary spending.",
                "data": {
                    "current_balance": round(self.current_balance, 2),
                    "daily_spending_rate": round(daily_rate, 2),
                    "projected_end_balance": round(projected_end_balance, 2),
                    "days_until_zero": days_until_zero,
                    "days_remaining": days_remaining
                },
                "priority": 0
            }
        elif projected_end_balance < 500:
            return {
                "id": "cashflow_warning",
                "type": "warning",
                "icon": "alert-circle",
                "title": "Low Balance Forecast",
                "headline": f"Month-end balance: ${projected_end_balance:,.0f}",
                "description": f"Your projected balance is getting tight. You're spending ${daily_rate:,.0f}/day on average with {days_remaining} days remaining.",
                "data": {
                    "current_balance": round(self.current_balance, 2),
                    "daily_spending_rate": round(daily_rate, 2),
                    "projected_end_balance": round(projected_end_balance, 2),
                    "days_remaining": days_remaining
                },
                "priority": 1
            }
        else:
            return {
                "id": "cashflow_forecast",
                "type": "positive",
                "icon": "check-circle",
                "title": "Healthy Cashflow",
                "headline": f"On track for ${projected_end_balance:,.0f} by month-end",
                "description": f"At your current pace, you'll have a comfortable buffer. Daily average: ${daily_rate:,.0f}.",
                "data": {
                    "current_balance": round(self.current_balance, 2),
                    "daily_spending_rate": round(daily_rate, 2),
                    "projected_end_balance": round(projected_end_balance, 2),
                    "days_remaining": days_remaining
                },
                "priority": 3
            }
    
    def weekend_spending_insight(self) -> Optional[Dict]:
        """Compare weekday vs weekend spending"""
        if not self.current_month_expenses:
            return None
        
        weekend_spending = 0
        weekday_spending = 0
        weekend_by_category = defaultdict(float)
        
        for t in self.current_month_expenses:
            date = self._parse_date(t["date"])
            if date.weekday() >= 5:  # Saturday = 5, Sunday = 6
                weekend_spending += t["amount"]
                weekend_by_category[t["category"]] += t["amount"]
            else:
                weekday_spending += t["amount"]
        
        if weekday_spending == 0 or weekend_spending == 0:
            return None
        
        # Calculate per-day averages
        # Roughly 8-9 weekend days and 22-23 weekday days per month
        weekend_days = 8
        weekday_days = 22
        
        weekend_daily_avg = weekend_spending / weekend_days
        weekday_daily_avg = weekday_spending / weekday_days
        
        ratio = weekend_daily_avg / weekday_daily_avg if weekday_daily_avg > 0 else 1
        
        # Find top weekend category
        top_weekend_cat = max(weekend_by_category.items(), key=lambda x: x[1]) if weekend_by_category else (None, 0)
        
        if ratio > 1.5:
            return {
                "id": "weekend_spending",
                "type": "warning",
                "icon": "calendar",
                "title": "Weekend Spike",
                "headline": f"You spend {ratio:.1f}x more on weekends",
                "description": f"Weekend daily average: ${weekend_daily_avg:,.0f} vs ${weekday_daily_avg:,.0f} on weekdays — mostly on {top_weekend_cat[0]}.",
                "data": {
                    "weekend_total": round(weekend_spending, 2),
                    "weekday_total": round(weekday_spending, 2),
                    "weekend_daily_avg": round(weekend_daily_avg, 2),
                    "weekday_daily_avg": round(weekday_daily_avg, 2),
                    "ratio": round(ratio, 2),
                    "top_weekend_category": top_weekend_cat[0],
                    "top_weekend_amount": round(top_weekend_cat[1], 2)
                },
                "priority": 2
            }
        elif ratio < 0.8:
            return {
                "id": "weekend_spending",
                "type": "positive",
                "icon": "calendar",
                "title": "Smart Weekender",
                "headline": "You spend less on weekends — nice!",
                "description": f"Weekend average: ${weekend_daily_avg:,.0f}/day vs ${weekday_daily_avg:,.0f}/day on weekdays. You're avoiding weekend splurges.",
                "data": {
                    "weekend_total": round(weekend_spending, 2),
                    "weekday_total": round(weekday_spending, 2),
                    "ratio": round(ratio, 2)
                },
                "priority": 3
            }
        
        return None
    
    def micro_spending_insight(self) -> Optional[Dict]:
        """Detect small frequent purchases under $10"""
        micro_threshold = 10
        micro_purchases = [t for t in self.current_month_expenses if t["amount"] < micro_threshold]
        
        if len(micro_purchases) < 5:
            return None
        
        micro_total = sum(t["amount"] for t in micro_purchases)
        micro_pct = (micro_total / self.current_month_total * 100) if self.current_month_total > 0 else 0
        
        # Group by category
        micro_by_cat = defaultdict(float)
        for t in micro_purchases:
            micro_by_cat[t["category"]] += t["amount"]
        
        top_micro_cat = max(micro_by_cat.items(), key=lambda x: x[1]) if micro_by_cat else (None, 0)
        
        if micro_pct > 10:
            return {
                "id": "micro_spending",
                "type": "warning",
                "icon": "coins",
                "title": "Small Purchases Add Up",
                "headline": f"${micro_total:,.0f} spent on purchases under ${micro_threshold}",
                "description": f"That's {micro_pct:.0f}% of your total spending from {len(micro_purchases)} small transactions — mostly {top_micro_cat[0]}. These 'invisible' expenses add up fast.",
                "data": {
                    "total": round(micro_total, 2),
                    "count": len(micro_purchases),
                    "percentage": round(micro_pct, 1),
                    "top_category": top_micro_cat[0],
                    "average_per_purchase": round(micro_total / len(micro_purchases), 2)
                },
                "priority": 2
            }
        
        return None
    
    def projection_insight(self) -> Optional[Dict]:
        """Simulate savings from reducing top category"""
        if not self.category_totals:
            return None
        
        sorted_cats = sorted(self.category_totals.items(), key=lambda x: x[1], reverse=True)
        top_cat, top_amount = sorted_cats[0]
        
        # Calculate 20% reduction savings
        reduction_pct = 20
        monthly_savings = top_amount * (reduction_pct / 100)
        yearly_savings = monthly_savings * 12
        
        # What could you do with the savings?
        savings_examples = []
        if yearly_savings > 2000:
            savings_examples.append("a vacation")
        if yearly_savings > 1000:
            savings_examples.append("an emergency fund boost")
        if yearly_savings > 500:
            savings_examples.append("new tech gear")
        
        example_text = f" That's enough for {savings_examples[0]}." if savings_examples else ""
        
        return {
            "id": "savings_projection",
            "type": "tip",
            "icon": "piggy-bank",
            "title": "Savings Opportunity",
            "headline": f"Save ${monthly_savings:,.0f}/month by cutting {top_cat} by {reduction_pct}%",
            "description": f"A {reduction_pct}% reduction in {top_cat} could save you ${yearly_savings:,.0f}/year.{example_text}",
            "data": {
                "target_category": top_cat,
                "current_spending": round(top_amount, 2),
                "reduction_percentage": reduction_pct,
                "monthly_savings": round(monthly_savings, 2),
                "yearly_savings": round(yearly_savings, 2)
            },
            "priority": 2
        }
    
    def spending_personality(self) -> Dict:
        """Classify user into a spending personality profile"""
        if not self.current_month_expenses:
            return {
                "type": "unknown",
                "label": "New User",
                "description": "We need more data to understand your spending style.",
                "recommendations": ["Upload your bank statement to get personalized insights."],
                "traits": []
            }
        
        # Calculate metrics for classification
        scores = {
            "comfort_spender": 0,
            "impulse_buyer": 0,
            "disciplined_saver": 0,
            "lifestyle_spender": 0
        }
        
        # 1. Check food/delivery spending (comfort spender indicator)
        food_pct = self.category_totals.get("Food & Dining", 0) / self.current_month_total * 100 if self.current_month_total > 0 else 0
        if food_pct > 25:
            scores["comfort_spender"] += 3
        elif food_pct > 15:
            scores["comfort_spender"] += 1
        
        # 2. Check weekend vs weekday ratio (comfort spender)
        weekend_spending = sum(t["amount"] for t in self.current_month_expenses 
                             if self._parse_date(t["date"]).weekday() >= 5)
        weekend_ratio = weekend_spending / self.current_month_total if self.current_month_total > 0 else 0
        if weekend_ratio > 0.4:
            scores["comfort_spender"] += 2
        
        # 3. Check small purchases (impulse buyer indicator)
        small_purchases = [t for t in self.current_month_expenses if t["amount"] < 15]
        small_pct = len(small_purchases) / len(self.current_month_expenses) * 100 if self.current_month_expenses else 0
        if small_pct > 50:
            scores["impulse_buyer"] += 3
        elif small_pct > 30:
            scores["impulse_buyer"] += 1
        
        # 4. Check transaction frequency (impulse buyer)
        unique_days = len(set(t["date"] for t in self.current_month_expenses))
        if unique_days > 20:
            scores["impulse_buyer"] += 2
        
        # 5. Check spending consistency (disciplined saver indicator)
        if self.last_month_total > 0:
            month_variance = abs(self.current_month_total - self.last_month_total) / self.last_month_total
            if month_variance < 0.1:
                scores["disciplined_saver"] += 3
            elif month_variance < 0.2:
                scores["disciplined_saver"] += 1
        
        # 6. Check savings rate
        if self.total_income > 0:
            savings_rate = (self.total_income - self.total_expenses) / self.total_income
            if savings_rate > 0.2:
                scores["disciplined_saver"] += 3
            elif savings_rate > 0.1:
                scores["disciplined_saver"] += 1
        
        # 7. Check lifestyle categories (lifestyle spender)
        lifestyle_cats = ["Entertainment", "Shopping", "Travel", "Subscriptions"]
        lifestyle_total = sum(self.category_totals.get(cat, 0) for cat in lifestyle_cats)
        lifestyle_pct = lifestyle_total / self.current_month_total * 100 if self.current_month_total > 0 else 0
        if lifestyle_pct > 40:
            scores["lifestyle_spender"] += 3
        elif lifestyle_pct > 25:
            scores["lifestyle_spender"] += 1
        
        # 8. Check category diversity
        active_categories = len([c for c, v in self.category_totals.items() if v > 0])
        if active_categories >= 6:
            scores["lifestyle_spender"] += 2
        
        # Determine dominant personality
        personality_type = max(scores, key=scores.get)
        
        personalities = {
            "comfort_spender": {
                "label": "Comfort Spender",
                "emoji": "🛋️",
                "description": "You prioritize convenience and experiences. Food delivery and weekend treats are your go-to stress relievers.",
                "traits": ["Enjoys convenience", "Weekend splurges", "Food-focused"],
                "recommendations": [
                    "Try meal prepping on Sundays to reduce delivery costs",
                    "Set a weekly 'treat yourself' budget to enjoy guilt-free"
                ]
            },
            "impulse_buyer": {
                "label": "Impulse Buyer",
                "emoji": "⚡",
                "description": "You make frequent, spontaneous purchases. Small transactions add up faster than you realize.",
                "traits": ["Frequent small purchases", "Spontaneous", "Variety seeker"],
                "recommendations": [
                    "Wait 24 hours before purchases over $20",
                    "Use a separate account for discretionary spending"
                ]
            },
            "disciplined_saver": {
                "label": "Disciplined Saver",
                "emoji": "🎯",
                "description": "You have consistent spending habits and prioritize saving. Your financial future looks bright.",
                "traits": ["Consistent patterns", "Goal-oriented", "Budget-conscious"],
                "recommendations": [
                    "Consider investing your surplus savings",
                    "You're doing great — treat yourself occasionally!"
                ]
            },
            "lifestyle_spender": {
                "label": "Lifestyle Spender",
                "emoji": "✨",
                "description": "You invest in experiences and quality of life. Entertainment, travel, and subscriptions define your spending.",
                "traits": ["Experience-focused", "Tech-savvy", "Social"],
                "recommendations": [
                    "Audit your subscriptions — you may have unused ones",
                    "Look for bundle deals on entertainment services"
                ]
            }
        }
        
        result = personalities[personality_type].copy()
        result["type"] = personality_type
        result["scores"] = scores
        result["dominant_score"] = scores[personality_type]
        
        return result
    
    def financial_health_score(self) -> Dict:
        """Calculate overall financial health score (0-100)"""
        if not self.transactions:
            return {
                "score": 0,
                "grade": "N/A",
                "description": "Not enough data to calculate your score.",
                "factors": []
            }
        
        factors = []
        total_points = 0
        max_points = 0
        
        # Factor 1: Spending Stability (25 points)
        max_points += 25
        if self.last_month_total > 0:
            variance = abs(self.current_month_total - self.last_month_total) / self.last_month_total
            if variance < 0.1:
                stability_score = 25
                stability_status = "excellent"
            elif variance < 0.2:
                stability_score = 20
                stability_status = "good"
            elif variance < 0.3:
                stability_score = 15
                stability_status = "moderate"
            else:
                stability_score = 10
                stability_status = "needs work"
            
            total_points += stability_score
            factors.append({
                "name": "Spending Stability",
                "score": stability_score,
                "max": 25,
                "status": stability_status,
                "detail": f"{variance*100:.0f}% month-over-month change"
            })
        
        # Factor 2: Category Balance (25 points)
        max_points += 25
        if self.category_totals:
            sorted_cats = sorted(self.category_totals.values(), reverse=True)
            top_cat_pct = sorted_cats[0] / sum(sorted_cats) * 100 if sum(sorted_cats) > 0 else 0
            
            if top_cat_pct < 30:
                balance_score = 25
                balance_status = "excellent"
            elif top_cat_pct < 40:
                balance_score = 20
                balance_status = "good"
            elif top_cat_pct < 50:
                balance_score = 15
                balance_status = "moderate"
            else:
                balance_score = 10
                balance_status = "concentrated"
            
            total_points += balance_score
            factors.append({
                "name": "Category Balance",
                "score": balance_score,
                "max": 25,
                "status": balance_status,
                "detail": f"Top category is {top_cat_pct:.0f}% of spending"
            })
        
        # Factor 3: Savings Rate (25 points)
        max_points += 25
        if self.total_income > 0:
            savings_rate = (self.total_income - self.total_expenses) / self.total_income
            
            if savings_rate > 0.2:
                savings_score = 25
                savings_status = "excellent"
            elif savings_rate > 0.1:
                savings_score = 20
                savings_status = "good"
            elif savings_rate > 0:
                savings_score = 15
                savings_status = "building"
            else:
                savings_score = 5
                savings_status = "deficit"
            
            total_points += savings_score
            factors.append({
                "name": "Savings Rate",
                "score": savings_score,
                "max": 25,
                "status": savings_status,
                "detail": f"{savings_rate*100:.0f}% of income saved"
            })
        
        # Factor 4: Cashflow Health (25 points)
        max_points += 25
        if self.current_balance > 1000:
            cashflow_score = 25
            cashflow_status = "excellent"
        elif self.current_balance > 500:
            cashflow_score = 20
            cashflow_status = "good"
        elif self.current_balance > 0:
            cashflow_score = 15
            cashflow_status = "tight"
        else:
            cashflow_score = 5
            cashflow_status = "negative"
        
        total_points += cashflow_score
        factors.append({
            "name": "Cashflow Health",
            "score": cashflow_score,
            "max": 25,
            "status": cashflow_status,
            "detail": f"${self.current_balance:,.0f} current balance"
        })
        
        # Calculate final score
        final_score = int((total_points / max_points) * 100) if max_points > 0 else 0
        
        # Determine grade
        if final_score >= 90:
            grade = "A+"
            description = "Exceptional financial health! You're in great shape."
        elif final_score >= 80:
            grade = "A"
            description = "Excellent financial health. Keep up the great work!"
        elif final_score >= 70:
            grade = "B"
            description = "Good financial health with room for improvement."
        elif final_score >= 60:
            grade = "C"
            description = "Fair financial health. Focus on the areas below."
        else:
            grade = "D"
            description = "Your finances need attention. Let's work on this together."
        
        # Find weakest factor for targeted advice
        weakest = min(factors, key=lambda x: x["score"] / x["max"]) if factors else None
        
        return {
            "score": final_score,
            "grade": grade,
            "description": description,
            "factors": factors,
            "weakest_factor": weakest["name"] if weakest else None,
            "improvement_tip": f"Focus on improving your {weakest['name'].lower()} to boost your score." if weakest else None
        }


def generate_insights(transactions: List[Dict]) -> Dict[str, Any]:
    """Main function to generate all insights"""
    engine = InsightsEngine(transactions)
    return engine.generate_all_insights()
