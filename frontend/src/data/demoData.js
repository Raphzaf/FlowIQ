// frontend/src/data/demoData.js

export const DEMO_USER = {
  name: "Demo User",
  email: "demo@flowiq.app",
  display_name: "Demo User",
  currency: "ILS",
  monthly_budget: 8000,
  monthly_income: 12000,
  onboarding_status: "completed",
};

// ~90 transactions across 3 months (Jan, Feb, Mar 2025)
// Categories: Supermarket, Restaurants, Transport, Utilities, Shopping, Entertainment, Health, Income
// Real Israeli merchant names. Income: ~12,000₪/month salary on the 1st.
export const demoTransactions = [
  // MARCH 2025 (most recent)
  // Income
  { id: "demo-1", date: "2025-03-01", description: "משכורת - חברת הייטק", amount: 12000, type: "income", category: "Income" },
  // Supermarket
  { id: "demo-2", date: "2025-03-02", description: "שופרסל דיל", amount: -320, type: "expense", category: "Supermarket" },
  { id: "demo-3", date: "2025-03-06", description: "רמי לוי", amount: -280, type: "expense", category: "Supermarket" },
  { id: "demo-4", date: "2025-03-13", description: "מחסני השוק", amount: -195, type: "expense", category: "Supermarket" },
  { id: "demo-5", date: "2025-03-20", description: "שופרסל אונליין", amount: -410, type: "expense", category: "Supermarket" },
  { id: "demo-6", date: "2025-03-27", description: "ויקטורי", amount: -230, type: "expense", category: "Supermarket" },
  // Restaurants
  { id: "demo-7", date: "2025-03-03", description: "קפה קפה", amount: -85, type: "expense", category: "Restaurants" },
  { id: "demo-8", date: "2025-03-07", description: "מקדונלדס", amount: -68, type: "expense", category: "Restaurants" },
  { id: "demo-9", date: "2025-03-10", description: "הומוס אבו חסן", amount: -52, type: "expense", category: "Restaurants" },
  { id: "demo-10", date: "2025-03-14", description: "פיצה האט", amount: -120, type: "expense", category: "Restaurants" },
  { id: "demo-11", date: "2025-03-18", description: "ארומה אספרסו בר", amount: -45, type: "expense", category: "Restaurants" },
  { id: "demo-12", date: "2025-03-22", description: "סושי בר", amount: -185, type: "expense", category: "Restaurants" },
  { id: "demo-13", date: "2025-03-26", description: "בורגר קינג", amount: -75, type: "expense", category: "Restaurants" },
  // Transport
  { id: "demo-14", date: "2025-03-04", description: "גט טקסי", amount: -65, type: "expense", category: "Transport" },
  { id: "demo-15", date: "2025-03-08", description: "דלק - פז", amount: -320, type: "expense", category: "Transport" },
  { id: "demo-16", date: "2025-03-15", description: "חנייה עיריית תל אביב", amount: -40, type: "expense", category: "Transport" },
  { id: "demo-17", date: "2025-03-21", description: "אוטובוס - רב-קו", amount: -25, type: "expense", category: "Transport" },
  { id: "demo-18", date: "2025-03-28", description: "גט טקסי", amount: -90, type: "expense", category: "Transport" },
  // Utilities
  { id: "demo-19", date: "2025-03-05", description: "בזק - אינטרנט", amount: -150, type: "expense", category: "Utilities" },
  { id: "demo-20", date: "2025-03-05", description: "חברת חשמל", amount: -280, type: "expense", category: "Utilities" },
  { id: "demo-21", date: "2025-03-05", description: "עירייה - ארנונה", amount: -400, type: "expense", category: "Utilities" },
  { id: "demo-22", date: "2025-03-10", description: "HOT מובייל", amount: -99, type: "expense", category: "Utilities" },
  // Shopping
  { id: "demo-23", date: "2025-03-09", description: "זארה - דיזנגוף סנטר", amount: -380, type: "expense", category: "Shopping" },
  { id: "demo-24", date: "2025-03-16", description: "אמזון ישראל", amount: -245, type: "expense", category: "Shopping" },
  { id: "demo-25", date: "2025-03-23", description: "H&M תל אביב", amount: -290, type: "expense", category: "Shopping" },
  // Entertainment
  { id: "demo-26", date: "2025-03-11", description: "נטפליקס", amount: -55, type: "expense", category: "Entertainment" },
  { id: "demo-27", date: "2025-03-11", description: "ספוטיפיי", amount: -25, type: "expense", category: "Entertainment" },
  { id: "demo-28", date: "2025-03-17", description: "Yes+ סרטים", amount: -39, type: "expense", category: "Entertainment" },
  { id: "demo-29", date: "2025-03-24", description: "סינמה סיטי", amount: -95, type: "expense", category: "Entertainment" },
  // Health
  { id: "demo-30", date: "2025-03-12", description: "מכבי שירותי בריאות", amount: -55, type: "expense", category: "Health" },
  { id: "demo-31", date: "2025-03-19", description: "סופר-פארם", amount: -145, type: "expense", category: "Health" },
  { id: "demo-32", date: "2025-03-25", description: "מכון כושר - הולמס פלייס", amount: -180, type: "expense", category: "Health" },

  // FEBRUARY 2025
  { id: "demo-33", date: "2025-02-01", description: "משכורת - חברת הייטק", amount: 12000, type: "income", category: "Income" },
  { id: "demo-34", date: "2025-02-02", description: "שופרסל דיל", amount: -295, type: "expense", category: "Supermarket" },
  { id: "demo-35", date: "2025-02-07", description: "רמי לוי", amount: -340, type: "expense", category: "Supermarket" },
  { id: "demo-36", date: "2025-02-14", description: "מחסני השוק", amount: -175, type: "expense", category: "Supermarket" },
  { id: "demo-37", date: "2025-02-21", description: "ויקטורי", amount: -260, type: "expense", category: "Supermarket" },
  { id: "demo-38", date: "2025-02-03", description: "ארומה אספרסו בר", amount: -55, type: "expense", category: "Restaurants" },
  { id: "demo-39", date: "2025-02-08", description: "מקדונלדס", amount: -72, type: "expense", category: "Restaurants" },
  { id: "demo-40", date: "2025-02-12", description: "קפה קפה", amount: -90, type: "expense", category: "Restaurants" },
  { id: "demo-41", date: "2025-02-17", description: "שווארמה יוסי", amount: -48, type: "expense", category: "Restaurants" },
  { id: "demo-42", date: "2025-02-22", description: "פונדק הסמטה", amount: -210, type: "expense", category: "Restaurants" },
  { id: "demo-43", date: "2025-02-26", description: "עוף טוב", amount: -35, type: "expense", category: "Restaurants" },
  { id: "demo-44", date: "2025-02-04", description: "גט טקסי", amount: -78, type: "expense", category: "Transport" },
  { id: "demo-45", date: "2025-02-10", description: "דלק - סונול", amount: -290, type: "expense", category: "Transport" },
  { id: "demo-46", date: "2025-02-18", description: "רכבת ישראל", amount: -35, type: "expense", category: "Transport" },
  { id: "demo-47", date: "2025-02-24", description: "חנייה - עיריית רמת גן", amount: -30, type: "expense", category: "Transport" },
  { id: "demo-48", date: "2025-02-05", description: "בזק - אינטרנט", amount: -150, type: "expense", category: "Utilities" },
  { id: "demo-49", date: "2025-02-05", description: "חברת חשמל", amount: -310, type: "expense", category: "Utilities" },
  { id: "demo-50", date: "2025-02-05", description: "עירייה - ארנונה", amount: -400, type: "expense", category: "Utilities" },
  { id: "demo-51", date: "2025-02-10", description: "סלקום", amount: -120, type: "expense", category: "Utilities" },
  { id: "demo-52", date: "2025-02-13", description: "ASOS", amount: -450, type: "expense", category: "Shopping" },
  { id: "demo-53", date: "2025-02-20", description: "איקאה נתניה", amount: -680, type: "expense", category: "Shopping" },
  { id: "demo-54", date: "2025-02-11", description: "נטפליקס", amount: -55, type: "expense", category: "Entertainment" },
  { id: "demo-55", date: "2025-02-11", description: "ספוטיפיי", amount: -25, type: "expense", category: "Entertainment" },
  { id: "demo-56", date: "2025-02-16", description: "גו-אאוט - הופעה", amount: -150, type: "expense", category: "Entertainment" },
  { id: "demo-57", date: "2025-02-09", description: "רופא משפחה - קופת חולים", amount: -30, type: "expense", category: "Health" },
  { id: "demo-58", date: "2025-02-19", description: "בית מרקחת", amount: -95, type: "expense", category: "Health" },
  { id: "demo-59", date: "2025-02-25", description: "מכון כושר - הולמס פלייס", amount: -180, type: "expense", category: "Health" },

  // JANUARY 2025
  { id: "demo-60", date: "2025-01-01", description: "משכורת - חברת הייטק", amount: 12000, type: "income", category: "Income" },
  { id: "demo-61", date: "2025-01-02", description: "שופרסל דיל", amount: -355, type: "expense", category: "Supermarket" },
  { id: "demo-62", date: "2025-01-08", description: "רמי לוי", amount: -315, type: "expense", category: "Supermarket" },
  { id: "demo-63", date: "2025-01-15", description: "אושר עד", amount: -220, type: "expense", category: "Supermarket" },
  { id: "demo-64", date: "2025-01-22", description: "שופרסל אקספרס", amount: -180, type: "expense", category: "Supermarket" },
  { id: "demo-65", date: "2025-01-29", description: "ויקטורי", amount: -245, type: "expense", category: "Supermarket" },
  { id: "demo-66", date: "2025-01-03", description: "קפה קפה", amount: -80, type: "expense", category: "Restaurants" },
  { id: "demo-67", date: "2025-01-09", description: "בורגר סלאם", amount: -95, type: "expense", category: "Restaurants" },
  { id: "demo-68", date: "2025-01-14", description: "פסטה בסטה", amount: -145, type: "expense", category: "Restaurants" },
  { id: "demo-69", date: "2025-01-20", description: "ארומה אספרסו בר", amount: -60, type: "expense", category: "Restaurants" },
  { id: "demo-70", date: "2025-01-25", description: "ד\"ר שאוורמה", amount: -55, type: "expense", category: "Restaurants" },
  { id: "demo-71", date: "2025-01-04", description: "גט טקסי", amount: -55, type: "expense", category: "Transport" },
  { id: "demo-72", date: "2025-01-11", description: "דלק - פז", amount: -340, type: "expense", category: "Transport" },
  { id: "demo-73", date: "2025-01-18", description: "רכבת ישראל", amount: -45, type: "expense", category: "Transport" },
  { id: "demo-74", date: "2025-01-26", description: "אוטובוס - רב-קו", amount: -30, type: "expense", category: "Transport" },
  { id: "demo-75", date: "2025-01-05", description: "בזק - אינטרנט", amount: -150, type: "expense", category: "Utilities" },
  { id: "demo-76", date: "2025-01-05", description: "חברת חשמל", amount: -320, type: "expense", category: "Utilities" },
  { id: "demo-77", date: "2025-01-05", description: "עירייה - ארנונה", amount: -400, type: "expense", category: "Utilities" },
  { id: "demo-78", date: "2025-01-10", description: "HOT מובייל", amount: -99, type: "expense", category: "Utilities" },
  { id: "demo-79", date: "2025-01-12", description: "פוקס - תל אביב", amount: -320, type: "expense", category: "Shopping" },
  { id: "demo-80", date: "2025-01-19", description: "אמזון ישראל", amount: -195, type: "expense", category: "Shopping" },
  { id: "demo-81", date: "2025-01-27", description: "קסטרו", amount: -270, type: "expense", category: "Shopping" },
  { id: "demo-82", date: "2025-01-11", description: "נטפליקס", amount: -55, type: "expense", category: "Entertainment" },
  { id: "demo-83", date: "2025-01-11", description: "ספוטיפיי", amount: -25, type: "expense", category: "Entertainment" },
  { id: "demo-84", date: "2025-01-16", description: "סינמה סיטי", amount: -85, type: "expense", category: "Entertainment" },
  { id: "demo-85", date: "2025-01-23", description: "אפל - iCloud", amount: -15, type: "expense", category: "Entertainment" },
  { id: "demo-86", date: "2025-01-07", description: "רופא עיניים - קופת חולים", amount: -60, type: "expense", category: "Health" },
  { id: "demo-87", date: "2025-01-17", description: "סופר-פארם", amount: -120, type: "expense", category: "Health" },
  { id: "demo-88", date: "2025-01-24", description: "מכון כושר - הולמס פלייס", amount: -180, type: "expense", category: "Health" },
  { id: "demo-89", date: "2025-01-28", description: "דנטלי - רופא שיניים", amount: -350, type: "expense", category: "Health" },
];

export const demoAccounts = [
  {
    id: "demo-account-1",
    name: "עו\"ש - בנק הפועלים",
    type: "checking",
    bank: "hapoalim",
    balance: 18450,
    currency: "ILS",
    account_number: "****1234",
    last_synced: "2025-03-28T10:30:00Z",
  },
  {
    id: "demo-account-2",
    name: "כרטיס אשראי - מקס",
    type: "credit",
    bank: "max",
    balance: -3240,
    currency: "ILS",
    account_number: "****5678",
    last_synced: "2025-03-28T10:30:00Z",
  },
];

// Compute aggregated dashboard data from transactions
const marchTxns = demoTransactions.filter(t => t.date.startsWith("2025-03"));
const febTxns = demoTransactions.filter(t => t.date.startsWith("2025-02"));
const janTxns = demoTransactions.filter(t => t.date.startsWith("2025-01"));

const sumExpenses = (txns) =>
  Math.abs(txns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0));
const sumIncome = (txns) =>
  txns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);

const categoryTotals = (txns) =>
  txns
    .filter(t => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {});

export const demoDashboardData = {
  total_balance: 15210,
  total_income: sumIncome(marchTxns),
  total_expenses: sumExpenses(marchTxns),
  spending_by_month: [
    { month: "Oct", amount: 7200 },
    { month: "Nov", amount: 8100 },
    { month: "Dec", amount: 9500 },
    { month: "Jan", amount: sumExpenses(janTxns) },
    { month: "Feb", amount: sumExpenses(febTxns) },
    { month: "Mar", amount: sumExpenses(marchTxns) },
  ],
  categories: categoryTotals(marchTxns),
};

export const demoCashflow = {
  predicted_end_balance: 4850,
  is_warning: false,
  daily_average_spending: 285,
  days_remaining: 3,
};

export const demoInsights = [
  {
    id: "demo-insight-1",
    type: "positive",
    title: "Savings rate: 42%",
    description: "You're saving ₪5,040 this month — well above the recommended 20% savings rate. Keep it up!",
  },
  {
    id: "demo-insight-2",
    type: "tip",
    title: "Dining out spending",
    description: "You spent ₪720 on restaurants this month across 7 visits. Cooking at home twice a week could save ₪200/month.",
  },
  {
    id: "demo-insight-3",
    type: "warning",
    title: "Grocery spend up 15%",
    description: "Supermarket spending increased by ₪180 vs last month. Shufersal Online accounted for ₪410 of this.",
  },
  {
    id: "demo-insight-4",
    type: "tip",
    title: "Subscription audit",
    description: "You have 3 active streaming subscriptions (Netflix, Spotify, Yes+) totalling ₪119/month.",
  },
  {
    id: "demo-insight-5",
    type: "positive",
    title: "Transport costs stable",
    description: "Transport expenses have stayed consistent at ~₪540/month over the past 3 months. Well managed!",
  },
];

export const demoUserProfile = {
  ...DEMO_USER,
  monthly_budget: 8000,
  monthly_income: 12000,
  monthly_income_day: 1,
  monthly_rent: 3200,
  monthly_rent_day: 1,
  monthly_subscriptions: 119,
  monthly_subscriptions_day: 11,
  monthly_other_fixed_expenses: 929,
  monthly_other_fixed_expenses_day: 5,
  timezone: "Asia/Jerusalem",
  onboarding_status: "completed",
};
