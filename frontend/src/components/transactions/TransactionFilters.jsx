import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const DATE_FORMAT = "dd MMM yyyy";

const toCategoryOption = (category) => {
  if (typeof category === "string") {
    return { name: category, emoji: "🏷️" };
  }

  return {
    name: category?.name || "Unknown",
    emoji: category?.emoji || "🏷️",
  };
};

const toBankOption = (bank) => {
  if (typeof bank === "string" || typeof bank === "number") {
    return { id: String(bank), name: `Bank ${bank}` };
  }

  return {
    id: String(bank?.id ?? bank?.bank_id ?? ""),
    name: bank?.name || `Bank ${bank?.id ?? bank?.bank_id}`,
  };
};

const formatDateRange = (dateRange) => {
  const from = dateRange?.from;
  const to = dateRange?.to;

  if (from && to) {
    return `${format(from, DATE_FORMAT)} - ${format(to, DATE_FORMAT)}`;
  }

  if (from) {
    return `From ${format(from, DATE_FORMAT)}`;
  }

  if (to) {
    return `Until ${format(to, DATE_FORMAT)}`;
  }

  return "Date";
};

const formatAmountRange = (amountRange) => {
  const min = amountRange?.min;
  const max = amountRange?.max;

  if (min !== "" && max !== "") {
    return `${min}₪ - ${max}₪`;
  }

  if (min !== "") {
    return `Min ${min}₪`;
  }

  if (max !== "") {
    return `Max ${max}₪`;
  }

  return "Amount";
};

const FilterControls = ({
  filters,
  setFilters,
  categoryOptions,
  bankOptions,
  compact = false,
}) => {
  const updateCategories = (category) => {
    setFilters((previous) => {
      const exists = previous.categories.includes(category);
      const categories = exists
        ? previous.categories.filter((item) => item !== category)
        : [...previous.categories, category];

      return { ...previous, categories };
    });
  };

  const updateBanks = (bankId) => {
    setFilters((previous) => {
      const exists = previous.banks.includes(bankId);
      const banks = exists
        ? previous.banks.filter((item) => item !== bankId)
        : [...previous.banks, bankId];

      return { ...previous, banks };
    });
  };

  return (
    <div
      className={cn(
        "flex gap-2",
        compact
          ? "flex-col"
          : "overflow-x-auto pb-1 md:flex-wrap md:overflow-visible"
      )}
    >
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-between rounded-full min-w-40">
            <span className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {formatDateRange(filters.dateRange)}
            </span>
            <ChevronsUpDown className="h-4 w-4 text-stone-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={filters.dateRange}
            onSelect={(range) =>
              setFilters((previous) => ({
                ...previous,
                dateRange: {
                  from: range?.from,
                  to: range?.to,
                },
              }))
            }
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-between rounded-full min-w-44">
            <span>Categories</span>
            {filters.categories.length > 0 ? (
              <Badge className="ml-2 rounded-full" variant="secondary">
                {filters.categories.length}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No category found.</CommandEmpty>
              <CommandGroup>
                {categoryOptions.map((category) => {
                  const checked = filters.categories.includes(category.name);
                  return (
                    <CommandItem
                      key={category.name}
                      value={category.name}
                      onSelect={() => updateCategories(category.name)}
                    >
                      <div className="h-4 w-4 rounded border flex items-center justify-center">
                        {checked ? <Check className="h-3 w-3" /> : null}
                      </div>
                      <span>{category.emoji}</span>
                      <span>{category.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-between rounded-full min-w-44">
            <span>{formatAmountRange(filters.amountRange)}</span>
            <ChevronsUpDown className="h-4 w-4 text-stone-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Min ₪"
              value={filters.amountRange.min}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  amountRange: {
                    ...previous.amountRange,
                    min: event.target.value,
                  },
                }))
              }
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Max ₪"
              value={filters.amountRange.max}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  amountRange: {
                    ...previous.amountRange,
                    max: event.target.value,
                  },
                }))
              }
            />
          </div>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() =>
              setFilters((previous) => ({
                ...previous,
                amountRange: { min: "", max: "" },
              }))
            }
          >
            Reset amount
          </Button>
        </PopoverContent>
      </Popover>

      <ToggleGroup
        type="single"
        value={filters.type}
        onValueChange={(value) => {
          if (!value) return;
          setFilters((previous) => ({ ...previous, type: value }));
        }}
        className="rounded-full border border-input bg-white p-1"
      >
        <ToggleGroupItem value="all" className="rounded-full px-3 text-xs">
          All
        </ToggleGroupItem>
        <ToggleGroupItem value="credit" className="rounded-full px-3 text-xs">
          Income
        </ToggleGroupItem>
        <ToggleGroupItem value="debit" className="rounded-full px-3 text-xs">
          Expense
        </ToggleGroupItem>
      </ToggleGroup>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-between rounded-full min-w-40">
            <span>Banks</span>
            {filters.banks.length > 0 ? (
              <Badge className="ml-2 rounded-full" variant="secondary">
                {filters.banks.length}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandInput placeholder="Search banks..." />
            <CommandList>
              <CommandEmpty>No bank found.</CommandEmpty>
              <CommandGroup>
                {bankOptions.map((bank) => {
                  const checked = filters.banks.includes(bank.id);
                  return (
                    <CommandItem
                      key={bank.id}
                      value={bank.name}
                      onSelect={() => updateBanks(bank.id)}
                    >
                      <div className="h-4 w-4 rounded border flex items-center justify-center">
                        {checked ? <Check className="h-3 w-3" /> : null}
                      </div>
                      <span>{bank.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const TransactionFilters = ({
  filters,
  setFilters,
  clearFilters,
  categories,
  banks,
  activeFilterCount,
}) => {
  const [searchValue, setSearchValue] = useState(filters.search || "");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const categoryOptions = useMemo(
    () => categories.map((category) => toCategoryOption(category)),
    [categories]
  );

  const bankOptions = useMemo(() => banks.map((bank) => toBankOption(bank)), [banks]);

  useEffect(() => {
    setSearchValue(filters.search || "");
  }, [filters.search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchValue !== filters.search) {
        setFilters((previous) => ({ ...previous, search: searchValue }));
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchValue, filters.search, setFilters]);

  const activeChips = useMemo(() => {
    const chips = [];

    if (filters.search) {
      chips.push({
        key: "search",
        label: `Search: ${filters.search}`,
        onRemove: () => setFilters((previous) => ({ ...previous, search: "" })),
      });
    }

    filters.categories.forEach((category) => {
      chips.push({
        key: `category-${category}`,
        label: category,
        onRemove: () =>
          setFilters((previous) => ({
            ...previous,
            categories: previous.categories.filter((item) => item !== category),
          })),
      });
    });

    if (filters.dateRange.from || filters.dateRange.to) {
      chips.push({
        key: "date-range",
        label: formatDateRange(filters.dateRange),
        onRemove: () =>
          setFilters((previous) => ({
            ...previous,
            dateRange: { from: undefined, to: undefined },
          })),
      });
    }

    if (filters.amountRange.min !== "" || filters.amountRange.max !== "") {
      chips.push({
        key: "amount-range",
        label: formatAmountRange(filters.amountRange),
        onRemove: () =>
          setFilters((previous) => ({
            ...previous,
            amountRange: { min: "", max: "" },
          })),
      });
    }

    if (filters.type !== "all") {
      chips.push({
        key: "type",
        label: filters.type === "credit" ? "Income" : "Expense",
        onRemove: () => setFilters((previous) => ({ ...previous, type: "all" })),
      });
    }

    filters.banks.forEach((bankId) => {
      const bankName =
        bankOptions.find((bank) => bank.id === bankId)?.name || `Bank ${bankId}`;
      chips.push({
        key: `bank-${bankId}`,
        label: bankName,
        onRemove: () =>
          setFilters((previous) => ({
            ...previous,
            banks: previous.banks.filter((item) => item !== bankId),
          })),
      });
    });

    return chips;
  }, [filters, setFilters, bankOptions]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search by merchant or category"
          className="h-12 pl-10 pr-10 rounded-xl"
          data-testid="transaction-search-input"
        />
        {searchValue ? (
          <button
            type="button"
            onClick={() => setSearchValue("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="md:hidden">
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="rounded-full">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 ? (
                <Badge variant="secondary" className="rounded-full">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Refine transactions with detailed filters.</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <FilterControls
                filters={filters}
                setFilters={setFilters}
                categoryOptions={categoryOptions}
                bankOptions={bankOptions}
                compact
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden md:block">
        <FilterControls
          filters={filters}
          setFilters={setFilters}
          categoryOptions={categoryOptions}
          bankOptions={bankOptions}
        />
      </div>

      <div className="md:hidden">
        <div className="overflow-x-auto pb-1">
          <FilterControls
            filters={filters}
            setFilters={setFilters}
            categoryOptions={categoryOptions}
            bankOptions={bankOptions}
          />
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-200"
            >
              {chip.label}
              <X className="h-3 w-3" />
            </button>
          ))}

          <Button
            type="button"
            variant="ghost"
            className="h-7 rounded-full px-3 text-xs"
            onClick={clearFilters}
          >
            Clear all filters
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default TransactionFilters;
