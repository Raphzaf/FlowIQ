import { useState, useCallback } from "react";
import { Pencil, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { toast } from "sonner";
import axios from "axios";

// Exact category list matching backend
const CATEGORIES = [
  "Supermarket",
  "Restaurants",
  "Transport",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Health",
  "Housing",
  "Education",
  "Travel",
  "Income",
  "Other",
];

const CATEGORY_CONFIG = {
  Supermarket:   { emoji: "🛒", bg: "bg-emerald-100", text: "text-emerald-800" },
  Restaurants:   { emoji: "🍔", bg: "bg-amber-100",   text: "text-amber-800"   },
  Transport:     { emoji: "🚗", bg: "bg-indigo-100",  text: "text-indigo-800"  },
  Utilities:     { emoji: "⚡", bg: "bg-yellow-100",  text: "text-yellow-800"  },
  Shopping:      { emoji: "🛍️", bg: "bg-pink-100",    text: "text-pink-800"    },
  Entertainment: { emoji: "🎬", bg: "bg-violet-100",  text: "text-violet-800"  },
  Health:        { emoji: "💊", bg: "bg-teal-100",    text: "text-teal-800"    },
  Housing:       { emoji: "🏠", bg: "bg-stone-100",   text: "text-stone-800"   },
  Education:     { emoji: "📚", bg: "bg-cyan-100",    text: "text-cyan-800"    },
  Travel:        { emoji: "✈️", bg: "bg-sky-100",     text: "text-sky-800"     },
  Income:        { emoji: "💰", bg: "bg-green-100",   text: "text-green-800"   },
  Other:         { emoji: "📦", bg: "bg-gray-100",    text: "text-gray-700"    },
};

const DEFAULT_CONFIG = { emoji: "📌", bg: "bg-stone-100", text: "text-stone-700" };

/**
 * CategoryBadge
 * Props:
 *   - transactionId: string
 *   - category: string (current displayed category)
 *   - userCategoryOverride: string | null (if set, shows "edited" dot)
 *   - API: string (base API URL from useApi)
 *   - onCategoryChange: (newCategory: string) => void (called on optimistic update)
 */
const CategoryBadge = ({ transactionId, category, userCategoryOverride, API, onCategoryChange }) => {
  const [open, setOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(category);
  const [isOverride, setIsOverride] = useState(!!userCategoryOverride);
  const [saving, setSaving] = useState(false);

  const config = CATEGORY_CONFIG[currentCategory] || DEFAULT_CONFIG;

  const handleSelect = useCallback(async (newCategory) => {
    if (newCategory === currentCategory) { setOpen(false); return; }

    // Optimistic update
    const prevCategory = currentCategory;
    const prevOverride = isOverride;
    setCurrentCategory(newCategory);
    setIsOverride(true);
    setOpen(false);
    if (onCategoryChange) onCategoryChange(newCategory);

    setSaving(true);
    try {
      await axios.patch(`${API}/transactions/${transactionId}/category`, { category: newCategory });
      toast.success(`Category updated to ${newCategory}`);
    } catch (err) {
      // Revert on error
      setCurrentCategory(prevCategory);
      setIsOverride(prevOverride);
      if (onCategoryChange) onCategoryChange(prevCategory);
      const detail = err?.response?.data?.detail;
      toast.error(detail ? `Failed to update category: ${detail}` : "Failed to update category");
    } finally {
      setSaving(false);
    }
  }, [currentCategory, isOverride, transactionId, API, onCategoryChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 hover:ring-2 hover:ring-offset-1 hover:ring-stone-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${config.bg} ${config.text} ${saving ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
          title="Click to change category"
          data-testid={`category-badge-${transactionId}`}
        >
          <span>{config.emoji}</span>
          <span>{currentCategory}</span>
          {/* "Edited" dot indicator */}
          {isOverride && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0"
              title="Manually edited"
              data-testid={`category-edited-dot-${transactionId}`}
            />
          )}
          {/* Edit pencil icon — shown on hover */}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 rounded-2xl shadow-lg border border-stone-200" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Search category…" className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-stone-400">No category found</CommandEmpty>
            <CommandGroup>
              {CATEGORIES.map((cat) => {
                const cfg = CATEGORY_CONFIG[cat] || DEFAULT_CONFIG;
                return (
                  <CommandItem
                    key={cat}
                    value={cat}
                    onSelect={() => handleSelect(cat)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-xl mx-1 my-0.5 text-sm"
                    data-testid={`category-option-${cat}`}
                  >
                    <span className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center text-sm flex-shrink-0`}>
                      {cfg.emoji}
                    </span>
                    <span className="flex-1 font-medium">{cat}</span>
                    {cat === currentCategory && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export { CATEGORY_CONFIG };
export default CategoryBadge;
