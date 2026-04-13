import { useState, useEffect, useCallback } from "react";
import { useApi } from "../App";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Target, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import BudgetCard from "../components/budget/BudgetCard";

const CURRENT_MONTH = new Date().toISOString().slice(0, 7); // YYYY-MM

const ALL_CATEGORIES = [
  "Food & Dining", "Supermarket", "Restaurants", "Transport", "Housing",
  "Shopping", "Subscriptions", "Entertainment", "Bills & Utilities",
  "Health", "Travel", "Savings",
];

const Skeleton = ({ className }) => <div className={`skeleton ${className}`} />;

const Budget = () => {
  const { API } = useApi();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  // form state
  const [formCategory, setFormCategory] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMonth, setFormMonth] = useState(CURRENT_MONTH);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null); // budget id being deleted

  const fetchBudgets = useCallback(async (month) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/budgets/summary`, { params: { month } });
      setBudgets(data);
    } catch (err) {
      console.error("Failed to fetch budgets", err);
      toast.error("Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => { fetchBudgets(selectedMonth); }, [fetchBudgets, selectedMonth]);

  const openAddDialog = () => {
    setEditingBudget(null);
    setFormCategory("");
    setFormAmount("");
    setFormMonth(selectedMonth);
    setDialogOpen(true);
  };

  const openEditDialog = (budget) => {
    setEditingBudget(budget);
    setFormCategory(budget.category);
    setFormAmount(String(budget.budget_amount));
    setFormMonth(selectedMonth);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formCategory || !formAmount) { toast.error("Please fill all fields"); return; }
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/budgets`, { category: formCategory, amount_ils: amount, month: formMonth });
      toast.success(editingBudget ? "Budget updated!" : "Budget created!");
      setDialogOpen(false);
      fetchBudgets(selectedMonth);
    } catch (err) {
      toast.error("Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (budget) => {
    setDeleting(budget.id);
    try {
      await axios.delete(`${API}/budgets/${budget.id}`);
      toast.success("Budget deleted");
      fetchBudgets(selectedMonth);
    } catch (err) {
      toast.error("Failed to delete budget");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div data-testid="budget-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="font-heading text-3xl lg:text-4xl font-bold text-stone-900 dark:text-stone-100 mb-1">Budgets</h1>
          <p className="text-stone-500 dark:text-stone-400">Track your monthly spending against your goals</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-11 rounded-xl w-40 text-sm" />
          <Button onClick={openAddDialog} className="rounded-xl bg-stone-900 hover:bg-stone-800 h-11 px-4 gap-2" data-testid="add-budget-btn">
            <Plus className="w-4 h-4" /> Add Budget
          </Button>
        </div>
      </div>

      {/* Budget Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="budgets-loading">
          {[1,2,3].map(i => <Skeleton key={i} className="h-52 rounded-3xl" />)}
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in" data-testid="budgets-empty">
          <div className="w-20 h-20 rounded-3xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-6">
            <PiggyBank className="w-10 h-10 text-stone-400 dark:text-stone-500" />
          </div>
          <h3 className="font-heading text-xl font-semibold text-stone-900 dark:text-stone-100 mb-2">No budgets yet</h3>
          <p className="text-stone-500 dark:text-stone-400 text-center max-w-sm mb-8">
            Set your first budget to start tracking your monthly spending by category.
          </p>
          <Button onClick={openAddDialog} className="rounded-full bg-stone-900 hover:bg-stone-800 h-12 px-8 gap-2">
            <Plus className="w-4 h-4" /> Set First Budget
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {budgets.map(budget => (
            <BudgetCard key={budget.id} budget={budget} onEdit={openEditDialog} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-0 shadow-premium-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl flex items-center gap-2">
              <Target className="w-5 h-5 text-stone-600" />
              {editingBudget ? "Edit Budget" : "New Budget"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Category</label>
              <Select value={formCategory} onValueChange={setFormCategory} disabled={!!editingBudget}>
                <SelectTrigger className="h-12 rounded-xl" data-testid="budget-category-select">
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Budget amount (₪)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 font-medium">₪</span>
                <Input type="number" min="1" step="1" value={formAmount} onChange={e => setFormAmount(e.target.value)}
                  placeholder="0" className="h-12 rounded-xl pl-8" data-testid="budget-amount-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Month</label>
              <Input type="month" value={formMonth} onChange={e => setFormMonth(e.target.value)}
                className="h-12 rounded-xl" data-testid="budget-month-input" />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl h-11">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-stone-900 hover:bg-stone-800 h-11 px-6" data-testid="budget-save-btn">
              {saving ? "Saving…" : "Save Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Budget;
