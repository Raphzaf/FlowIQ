const BudgetProgress = ({ percentage, status }) => {
  const clampedPct = Math.min(percentage, 100);
  const colors = {
    ok: { bar: "bg-emerald-500", text: "text-emerald-700", glow: "" },
    warning: { bar: "bg-amber-500", text: "text-amber-700", glow: "" },
    exceeded: { bar: "bg-rose-500", text: "text-rose-700", glow: "shadow-[0_0_8px_rgba(239,68,68,0.4)] ring-1 ring-rose-300" },
  };
  const c = colors[status] || colors.ok;
  return (
    <div className="space-y-1.5">
      <div className={`relative h-2.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden ${status === "exceeded" ? c.glow : ""}`}>
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${c.bar}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
      <p className={`text-xs font-semibold tabular-nums ${c.text}`}>
        {percentage.toFixed(0)}%{status === "exceeded" ? " — Over budget!" : status === "warning" ? " — Almost there" : ""}
      </p>
    </div>
  );
};

export default BudgetProgress;
