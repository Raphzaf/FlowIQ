# FlowIQ - Personal Finance Intelligence Dashboard

## Original Problem Statement
Build a modern web app MVP called "FlowIQ" — a personal finance intelligence dashboard that acts as a smart CFO for users. Help users understand, predict, and optimize their spending through automated insights and a clean financial dashboard.

## Target User
Young professionals (20–35) who want better control over their money but don't want complex tools.

## User Choices
- **Authentication**: Skipped for MVP
- **Database**: MongoDB (pre-configured)
- **Demo Data**: Yes, auto-seeded on first load
- **Theme**: Apple-Minimal with Stone colors (Manrope + Inter fonts)

## Architecture

### Backend (FastAPI)
- **Database**: MongoDB with Motor async driver
- **Endpoints**:
  - `GET /api/transactions` - List all transactions
  - `POST /api/transactions` - Create transaction
  - `DELETE /api/transactions/{id}` - Delete transaction
  - `POST /api/seed-demo-data` - Seed demo data
  - `DELETE /api/clear-data` - Clear all data
  - `GET /api/dashboard` - Get dashboard summary (balance, categories, monthly spending)
  - `GET /api/insights` - Get smart insights (rule-based)
  - `GET /api/cashflow-prediction` - Get end-of-month prediction
  - `POST /api/upload-csv` - Upload bank statement CSV

### Frontend (React)
- **Pages**: Dashboard, Insights, Upload
- **Components**: BalanceCard, CashflowCard, SpendingChart, CategoryChart, InsightCard, UploadZone
- **Charts**: Recharts (Bar, Pie)
- **UI**: Shadcn/UI components with custom styling

## What's Been Implemented ✅
- [x] Dashboard with total balance, income/expense breakdown
- [x] Monthly spending bar chart (6 months)
- [x] Category breakdown donut chart
- [x] Cashflow prediction with warning states
- [x] Smart insights (5 rule-based insights) - UPGRADED
- [x] CSV upload with drag-drop
- [x] Demo data auto-seeding (90 days of transactions)
- [x] Mobile-responsive navigation
- [x] Premium Apple-minimal design

### Advanced Insights System (v2) ✅
- [x] **7 Insight Types**: Spending Trend, Category Dominance, Subscription Detection, Cashflow Warning, Weekend Spending, Micro-Spending, Savings Projection
- [x] **Spending Personality**: Classifies users as Comfort Spender, Impulse Buyer, Disciplined Saver, or Lifestyle Spender with personalized traits and recommendations
- [x] **Financial Health Score**: 0-100 score with grade (A+ to D), 4 factor breakdown (Spending Stability, Category Balance, Savings Rate, Cashflow Health), and improvement tips

### Premium UI Design (v3) ✅
- [x] **Bento Grid Layout**: 12-column grid with varied card sizes
- [x] **Hero Balance Card**: Dark gradient with animated number counters
- [x] **Premium Cards**: Rounded corners (24px), soft shadows, hover lift effects
- [x] **Charts**: Rounded bar ends, premium tooltips with glassmorphism
- [x] **Typography**: Manrope headings, Inter body, tabular numbers
- [x] **Micro-interactions**: Fade-in animations, hover effects, skeleton loaders
- [x] **Navigation**: Pill-style with glassmorphism backdrop
- [x] **Insights**: Color-coded cards (success/warning/info/tip) with badges

### Quick Expense Entry (v4) ✅
- [x] **Floating Action Button (FAB)**: Bottom-right corner, opens expense drawer
- [x] **Quick Entry Drawer**: Slide-up modal with amount input and quick amounts ($5-$100)
- [x] **Category Selection**: 8 categories with icons, frequent categories marked with green dot
- [x] **Merchant Suggestions**: Recent merchants auto-suggested based on selected category
- [x] **Success Animation**: Full-screen feedback with category-specific messages (e.g., "Coffee run tracked! ☕")
- [x] **Transaction History Page**: Search, date/category filters, edit/delete modals
- [x] **Weekly Budget Widget**: Progress bar showing spending vs $500 weekly budget

### Mobile Widget PWA (v5) ✅
- [x] **Dedicated Widget Page (/widget)**: Mobile-optimized standalone expense entry
- [x] **PWA Manifest**: Install to home screen on iOS/Android
- [x] **Gamification System**: 
  - Points for each expense (+10-15 pts)
  - Streak counter (consecutive days tracking)
  - Milestone bonuses (first expense of day, every 5th expense)
- [x] **Success Animation**: Confetti, category emoji, points earned
- [x] **Today's Stats**: Live spending total and expense count in header
- [x] **Quick Amounts**: 8 preset amounts ($5-$100)
- [x] **Install Banner**: French prompt "Ajouter le widget sur votre téléphone"

## Smart Insights Logic (v2)
1. **Month over Month**: Compares current vs last month spending
2. **Subscription Count**: Identifies recurring subscriptions
3. **Top Category**: Shows biggest expense category
4. **Savings Opportunity**: Suggests 20% reduction in Food & Dining
5. **Weekend Spending**: Alerts if >40% spending on weekends

## Prioritized Backlog

### P0 (Critical)
- All implemented ✅

### P1 (Important)
- [ ] User authentication (JWT or Google OAuth)
- [ ] Transaction editing capability
- [ ] Category auto-detection from merchant names
- [ ] Export data to CSV

### P2 (Nice to Have)
- [ ] Budget setting per category
- [ ] Goal tracking (savings goals)
- [ ] Recurring expense detection
- [ ] Dark mode toggle
- [ ] Multi-currency support
- [ ] Email notifications for overspending

## Next Tasks
1. Add user authentication if needed for multi-user support
2. Implement transaction search/filter
3. Add budget alerts when category exceeds threshold
4. Create mobile app using React Native
