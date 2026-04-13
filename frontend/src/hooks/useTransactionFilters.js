import { useCallback, useMemo, useState } from "react";

export const DEFAULT_TRANSACTION_FILTERS = {
  search: "",
  categories: [],
  dateRange: { from: undefined, to: undefined },
  amountRange: { min: "", max: "" },
  banks: [],
  type: "all",
};

const normalizeType = (value) => {
  if (!value) return "debit";
  const normalized = String(value).toLowerCase();

  if (normalized === "debit" || normalized === "expense") {
    return "debit";
  }

  if (normalized === "credit" || normalized === "income") {
    return "credit";
  }

  return normalized;
};

const getMerchantName = (transaction) =>
  transaction?.merchant_name || transaction?.merchant || "";

const getCategoryName = (transaction) => transaction?.category || "";

const getBankId = (transaction) =>
  transaction?.bank_id === null || transaction?.bank_id === undefined
    ? ""
    : String(transaction.bank_id);

const getAmountValue = (transaction) => {
  const amount = Number(transaction?.amount);
  return Number.isFinite(amount) ? amount : 0;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const cloneFilters = (filters = DEFAULT_TRANSACTION_FILTERS) => ({
  search: filters.search || "",
  categories: Array.isArray(filters.categories) ? [...filters.categories] : [],
  dateRange: {
    from: filters.dateRange?.from ? new Date(filters.dateRange.from) : undefined,
    to: filters.dateRange?.to ? new Date(filters.dateRange.to) : undefined,
  },
  amountRange: {
    min: filters.amountRange?.min ?? "",
    max: filters.amountRange?.max ?? "",
  },
  banks: Array.isArray(filters.banks) ? [...filters.banks] : [],
  type: filters.type || "all",
});

export const getActiveFilterCount = (filters) => {
  let count = 0;

  if (filters.search?.trim()) count += 1;
  if (filters.categories?.length) count += 1;
  if (filters.banks?.length) count += 1;
  if (filters.type && filters.type !== "all") count += 1;

  if (filters.dateRange?.from || filters.dateRange?.to) count += 1;

  const hasMin =
    filters.amountRange?.min !== "" &&
    filters.amountRange?.min !== null &&
    filters.amountRange?.min !== undefined;
  const hasMax =
    filters.amountRange?.max !== "" &&
    filters.amountRange?.max !== null &&
    filters.amountRange?.max !== undefined;

  if (hasMin || hasMax) count += 1;

  return count;
};

export const filterTransactions = (
  transactions = [],
  incomingFilters = DEFAULT_TRANSACTION_FILTERS
) => {
  const filters = cloneFilters(incomingFilters);
  let filtered = Array.isArray(transactions) ? [...transactions] : [];

  const search = filters.search.trim().toLowerCase();
  if (search) {
    filtered = filtered.filter((transaction) => {
      const merchant = getMerchantName(transaction).toLowerCase();
      const category = getCategoryName(transaction).toLowerCase();
      return merchant.includes(search) || category.includes(search);
    });
  }

  if (filters.categories.length > 0) {
    const categorySet = new Set(filters.categories);
    filtered = filtered.filter((transaction) =>
      categorySet.has(getCategoryName(transaction))
    );
  }

  if (filters.banks.length > 0) {
    const bankSet = new Set(filters.banks.map((bank) => String(bank)));
    filtered = filtered.filter((transaction) => bankSet.has(getBankId(transaction)));
  }

  if (filters.type !== "all") {
    filtered = filtered.filter(
      (transaction) => normalizeType(transaction?.type) === filters.type
    );
  }

  const fromDate = parseDate(filters.dateRange?.from);
  const toDate = parseDate(filters.dateRange?.to);

  if (fromDate || toDate) {
    filtered = filtered.filter((transaction) => {
      const date = parseDate(transaction?.date);
      if (!date) return false;

      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }

  const min =
    filters.amountRange?.min === "" || filters.amountRange?.min === null
      ? null
      : Number(filters.amountRange.min);
  const max =
    filters.amountRange?.max === "" || filters.amountRange?.max === null
      ? null
      : Number(filters.amountRange.max);

  if (Number.isFinite(min) || Number.isFinite(max)) {
    filtered = filtered.filter((transaction) => {
      const amount = Math.abs(getAmountValue(transaction));
      if (Number.isFinite(min) && amount < min) return false;
      if (Number.isFinite(max) && amount > max) return false;
      return true;
    });
  }

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalAmount = filtered
    .filter((transaction) => normalizeType(transaction?.type) === "debit")
    .reduce((sum, transaction) => sum + Math.abs(getAmountValue(transaction)), 0);

  return {
    filtered,
    totalCount: filtered.length,
    totalAmount,
    activeFilterCount: getActiveFilterCount(filters),
  };
};

const useTransactionFilters = (
  transactions = [],
  initialFilters = DEFAULT_TRANSACTION_FILTERS
) => {
  const [filters, setFilters] = useState(() => cloneFilters(initialFilters));

  const updateFilters = useCallback((updater) => {
    setFilters((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      return cloneFilters(next);
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(cloneFilters(DEFAULT_TRANSACTION_FILTERS));
  }, []);

  const result = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters]
  );

  return {
    filters,
    setFilters: updateFilters,
    clearFilters,
    ...result,
  };
};

export default useTransactionFilters;
