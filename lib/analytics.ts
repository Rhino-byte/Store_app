import {
  dateKeysInclusive,
  isDateKeyInRange,
  rollingDateRange,
  todayDateKey,
  transactionDateKey,
} from "@/lib/dates";
import {
  DEFAULT_STOCK_DESTINATION,
  STOCK_DESTINATIONS,
  type DashboardStats,
  type InventoryItem,
  type Transaction,
} from "./types";
import { isLowStock, isOutOfStock } from "./stock";
import {
  groupDestinationIssues,
  type DestinationIssue,
} from "@/lib/destination-issues";

export type { DestinationIssue };
export { groupDestinationIssues };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type AnalyticsWindow = {
  from: string;
  to: string;
  span: number;
};

export function analyticsWindowFromDays(days: number): AnalyticsWindow {
  const span = days <= 0 ? 1 : days;
  const { from, to } = rollingDateRange(span);
  return { from, to, span };
}

export function analyticsWindowFromRange(
  from: string,
  to: string
): AnalyticsWindow {
  const span = Math.max(1, dateKeysInclusive(from, to).length);
  return { from, to, span };
}

function resolveWindow(
  days: number,
  range?: { from?: string; to?: string }
): AnalyticsWindow {
  if (range?.from && range?.to) {
    return analyticsWindowFromRange(range.from, range.to);
  }
  return analyticsWindowFromDays(days);
}

export type InventoryOption = {
  itemId: string;
  itemName: string;
  category: string;
};

export type StockHealthSnapshot = {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  atOrBelowReorderCount: number;
};

export type DestinationTotal = {
  destination: string;
  quantity: number;
};

export type DailyInOutPoint = {
  date: string;
  label: string;
  in: number;
  out: number;
};

/** Stock-in of one item on one calendar day. */
export type StockInReceipt = {
  date: string;
  itemId: string;
  itemName: string;
  quantity: number;
};

export type ItemOutMatrix = {
  from: string;
  to: string;
  dates: string[];
  labels: string[];
  /** Daily out quantities aligned to `dates`. */
  byItemId: Record<string, number[]>;
  /** Suggested default item IDs (top movers) for compare chart. */
  topItemIds: string[];
};

/** @deprecated Use ItemOutMatrix */
export type WeeklyItemOutMatrix = ItemOutMatrix;

export type UserActivitySeries = {
  users: string[];
  points: Array<Record<string, string | number>>;
};

export type DailyStockItem = {
  itemId: string;
  itemName: string;
  stockIn: number;
  stockOut: number;
  destination: string;
};

function itemCategoryMap(items: InventoryItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.itemId, item.category?.trim() || "Uncategorized");
  }
  return map;
}

export function resolveTransactionDestination(tx: Transaction): string {
  const dest = tx.destination?.trim();
  if (dest) return dest;
  return DEFAULT_STOCK_DESTINATION;
}

function matchesDestination(
  tx: Transaction,
  destination?: string | null
): boolean {
  const filter = destination?.trim();
  if (!filter || filter === "all") return true;
  return resolveTransactionDestination(tx) === filter;
}

function filterOutTransactions(
  transactions: Transaction[],
  options?: {
    from?: string;
    to?: string;
    itemIds?: Set<string>;
    category?: string;
    categoryByItemId?: Map<string, string>;
    destination?: string | null;
  }
): Transaction[] {
  const categoryFilter = options?.category?.trim();
  return transactions.filter((tx) => {
    if (tx.type !== "out") return false;
    if (options?.itemIds && !options.itemIds.has(tx.itemId)) return false;
    if (options?.from && options?.to) {
      const day = transactionDateKey(tx.timestamp);
      if (!isDateKeyInRange(day, options.from, options.to)) return false;
    }
    if (categoryFilter && categoryFilter !== "all") {
      const cat =
        options?.categoryByItemId?.get(tx.itemId) ?? "Uncategorized";
      if (cat !== categoryFilter) return false;
    }
    if (!matchesDestination(tx, options?.destination)) return false;
    return true;
  });
}

function weekdayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAY_LABELS[utc.getUTCDay()];
}

/** Prefer real calendar labels; avoid opaque Day N for long ranges. */
function periodAxisLabel(dateKey: string, span: number): string {
  if (span <= 7) return weekdayLabel(dateKey);
  return dateKey.slice(5); // MM-DD
}

export function buildDashboardStats(
  items: InventoryItem[],
  transactions: Transaction[]
): DashboardStats {
  const todayKey = todayDateKey();
  const todayMovements = transactions.filter(
    (tx) => transactionDateKey(tx.timestamp) === todayKey
  ).length;

  return {
    totalItems: items.length,
    lowStockCount: items.filter(isLowStock).length,
    outOfStockCount: items.filter(isOutOfStock).length,
    todayMovements,
  };
}

/** Current inventory health (not destination-filtered). */
export function stockHealthSnapshot(items: InventoryItem[]): StockHealthSnapshot {
  return {
    totalItems: items.length,
    lowStockCount: items.filter(isLowStock).length,
    outOfStockCount: items.filter(isOutOfStock).length,
    atOrBelowReorderCount: items.filter(
      (item) => item.reorderLevel !== null && item.closingStock <= item.reorderLevel
    ).length,
  };
}

/**
 * Inclusive app-timezone calendar window.
 * days <= 0 → today only; days = 7 → today and the prior 6 days.
 */
export function filterTransactionsByDays(
  transactions: Transaction[],
  days: number,
  range?: { from?: string; to?: string }
): Transaction[] {
  const { from, to } = resolveWindow(days, range);
  return transactions.filter((tx) => {
    const day = transactionDateKey(tx.timestamp);
    return isDateKeyInRange(day, from, to);
  });
}

export function groupStockByCategory(items: InventoryItem[]) {
  const grouped = new Map<string, number>();
  for (const item of items) {
    const key = item.category || "Uncategorized";
    grouped.set(key, (grouped.get(key) ?? 0) + item.closingStock);
  }
  return Array.from(grouped.entries()).map(([category, stock]) => ({
    category,
    stock,
  }));
}

export function topConsumedItems(transactions: Transaction[], limit = 10) {
  const totals = new Map<string, { itemName: string; quantity: number }>();
  for (const tx of transactions) {
    if (tx.type !== "out") continue;
    const current = totals.get(tx.itemId) ?? {
      itemName: tx.itemName,
      quantity: 0,
    };
    current.quantity += tx.quantity;
    totals.set(tx.itemId, current);
  }

  return Array.from(totals.entries())
    .map(([itemId, data]) => ({ itemId, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

/**
 * Daily in/out for a category. Destination filter applies only to outs.
 * Zero-filled for every day in the range.
 */
export function dailyInOutMovement(
  transactions: Transaction[],
  items: InventoryItem[],
  days: number,
  options?: {
    category?: string;
    destination?: string | null;
    from?: string;
    to?: string;
  }
): DailyInOutPoint[] {
  const { from, to, span } = resolveWindow(days, options);
  const dayKeys = dateKeysInclusive(from, to);
  const categoryByItemId = itemCategoryMap(items);
  const category = options?.category?.trim();

  const byDay = new Map<string, { in: number; out: number }>();
  for (const day of dayKeys) {
    byDay.set(day, { in: 0, out: 0 });
  }

  for (const tx of transactions) {
    const day = transactionDateKey(tx.timestamp);
    if (!byDay.has(day)) continue;

    if (category && category !== "all") {
      const cat = categoryByItemId.get(tx.itemId) ?? "Uncategorized";
      if (cat !== category) continue;
    }

    const row = byDay.get(day)!;
    if (tx.type === "in") {
      row.in += tx.quantity;
    } else if (tx.type === "out" && matchesDestination(tx, options?.destination)) {
      row.out += tx.quantity;
    }
  }

  return dayKeys.map((date) => ({
    date,
    label: periodAxisLabel(date, span),
    in: byDay.get(date)?.in ?? 0,
    out: byDay.get(date)?.out ?? 0,
  }));
}

/**
 * Dated stock-in rows for the daily in-bar drill-down.
 * Same category/range as dailyInOutMovement (destination does not apply).
 */
export function stockInReceipts(
  transactions: Transaction[],
  items: InventoryItem[],
  days: number,
  options?: { category?: string; from?: string; to?: string }
): StockInReceipt[] {
  const { from, to } = resolveWindow(days, options);
  const categoryByItemId = itemCategoryMap(items);
  const category = options?.category?.trim();
  const totals = new Map<string, StockInReceipt>();

  for (const tx of transactions) {
    if (tx.type !== "in") continue;
    const date = transactionDateKey(tx.timestamp);
    if (!date || !isDateKeyInRange(date, from, to)) continue;
    if (category && category !== "all") {
      const cat = categoryByItemId.get(tx.itemId) ?? "Uncategorized";
      if (cat !== category) continue;
    }
    const key = `${date}::${tx.itemId}`;
    const current = totals.get(key);
    if (current) {
      current.quantity += tx.quantity;
    } else {
      totals.set(key, {
        date,
        itemId: tx.itemId,
        itemName: tx.itemName,
        quantity: tx.quantity,
      });
    }
  }

  return Array.from(totals.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (b.quantity !== a.quantity) return b.quantity - a.quantity;
    return a.itemName.localeCompare(b.itemName);
  });
}

/** @deprecated Prefer dailyInOutMovement */
export function dailyMovementTotals(transactions: Transaction[]) {
  const totals = new Map<string, { in: number; out: number }>();
  for (const tx of transactions) {
    const day = transactionDateKey(tx.timestamp);
    if (!day) continue;
    const current = totals.get(day) ?? { in: 0, out: 0 };
    if (tx.type === "in") current.in += tx.quantity;
    else current.out += tx.quantity;
    totals.set(day, current);
  }

  return Array.from(totals.entries())
    .map(([date, values]) => ({ date, ...values }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function itemMovementTotals(transactions: Transaction[]) {
  const totals = new Map<string, { itemName: string; in: number; out: number }>();
  for (const tx of transactions) {
    const current = totals.get(tx.itemId) ?? {
      itemName: tx.itemName,
      in: 0,
      out: 0,
    };
    if (tx.type === "in") current.in += tx.quantity;
    else current.out += tx.quantity;
    totals.set(tx.itemId, current);
  }

  return Array.from(totals.entries())
    .map(([itemId, values]) => ({
      itemId,
      itemName: values.itemName,
      in: values.in,
      out: values.out,
      net: values.in - values.out,
    }))
    .sort((a, b) => b.in + b.out - (a.in + a.out));
}

/**
 * Stock-out totals by destination for a category in the selected range.
 * Ignores destination filter (always shows full breakdown).
 */
export function destinationBreakdown(
  transactions: Transaction[],
  items: InventoryItem[],
  days: number,
  options?: { category?: string; from?: string; to?: string }
): DestinationTotal[] {
  const { from, to } = resolveWindow(days, options);
  const categoryByItemId = itemCategoryMap(items);
  const outs = filterOutTransactions(transactions, {
    from,
    to,
    category: options?.category,
    categoryByItemId,
    destination: "all",
  });

  const totals = new Map<string, number>();
  for (const dest of STOCK_DESTINATIONS) {
    totals.set(dest, 0);
  }

  for (const tx of outs) {
    const dest = resolveTransactionDestination(tx);
    totals.set(dest, (totals.get(dest) ?? 0) + tx.quantity);
  }

  return Array.from(totals.entries())
    .map(([destination, quantity]) => ({ destination, quantity }))
    .filter((row) => row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);
}

/**
 * Dated stock-out rows for the destination pie drill-down.
 * Same category/range as destinationBreakdown (ignores destination filter).
 */
export function destinationIssues(
  transactions: Transaction[],
  items: InventoryItem[],
  days: number,
  options?: { category?: string; from?: string; to?: string }
): DestinationIssue[] {
  const { from, to } = resolveWindow(days, options);
  const categoryByItemId = itemCategoryMap(items);
  const outs = filterOutTransactions(transactions, {
    from,
    to,
    category: options?.category,
    categoryByItemId,
    destination: "all",
  });
  return groupDestinationIssues(outs);
}

/** Per-item aggregates for a single calendar day (YYYY-MM-DD). */
export function itemDailyMovement(
  transactions: Transaction[],
  dateKey: string
): DailyStockItem[] {
  const totals = new Map<
    string,
    {
      itemName: string;
      stockIn: number;
      stockOut: number;
      destinations: Set<string>;
    }
  >();

  for (const tx of transactions) {
    if (!tx.timestamp || transactionDateKey(tx.timestamp) !== dateKey) continue;

    const current = totals.get(tx.itemId) ?? {
      itemName: tx.itemName,
      stockIn: 0,
      stockOut: 0,
      destinations: new Set<string>(),
    };

    if (tx.type === "in") {
      current.stockIn += tx.quantity;
    } else {
      current.stockOut += tx.quantity;
      current.destinations.add(resolveTransactionDestination(tx));
    }

    totals.set(tx.itemId, current);
  }

  return Array.from(totals.entries())
    .map(([itemId, values]) => ({
      itemId,
      itemName: values.itemName,
      stockIn: values.stockIn,
      stockOut: values.stockOut,
      destination: Array.from(values.destinations).sort().join(", "),
    }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName));
}

/**
 * Count of transactions per userEmail per calendar day.
 * Destination filter applies to outs only; stock-ins always count.
 */
export function userActivityByDay(
  transactions: Transaction[],
  days: number,
  options?: {
    destination?: string | null;
    category?: string;
    items?: InventoryItem[];
    from?: string;
    to?: string;
  }
): UserActivitySeries {
  const { from, to } = resolveWindow(days, options);
  const dayKeys = dateKeysInclusive(from, to);
  const categoryByItemId = options?.items
    ? itemCategoryMap(options.items)
    : undefined;
  const category = options?.category?.trim();

  const usersSet = new Set<string>();
  const counts = new Map<string, Map<string, number>>();

  for (const day of dayKeys) {
    counts.set(day, new Map());
  }

  for (const tx of transactions) {
    if (!tx.timestamp) continue;
    const day = transactionDateKey(tx.timestamp);
    if (!counts.has(day)) continue;

    if (category && category !== "all" && categoryByItemId) {
      const cat = categoryByItemId.get(tx.itemId) ?? "Uncategorized";
      if (cat !== category) continue;
    }

    if (tx.type === "out" && !matchesDestination(tx, options?.destination)) {
      continue;
    }

    const user = tx.userEmail?.trim() || "Unknown";
    usersSet.add(user);
    const dayMap = counts.get(day)!;
    dayMap.set(user, (dayMap.get(user) ?? 0) + 1);
  }

  const users = Array.from(usersSet).sort((a, b) => a.localeCompare(b));
  const points = dayKeys.map((date) => {
    const row: Record<string, string | number> = { date };
    const dayMap = counts.get(date)!;
    for (const user of users) {
      row[user] = dayMap.get(user) ?? 0;
    }
    return row;
  });

  return { users, points };
}

/** Distinct categories from inventory, sorted, with Uncategorized for blanks. */
export function listCategories(items: InventoryItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    set.add(item.category?.trim() || "Uncategorized");
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function inventoryOptions(
  items: InventoryItem[],
  category?: string
): InventoryOption[] {
  const cat = category?.trim();
  return items
    .filter((item) => {
      if (!cat || cat === "all") return true;
      return (item.category?.trim() || "Uncategorized") === cat;
    })
    .map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      category: item.category?.trim() || "Uncategorized",
    }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName));
}

const COMPARE_DEFAULT_COUNT = 3;

/**
 * Item out matrix for compare chart.
 * Span matches the page range so every daily value in the filter is plotted.
 * Series data covers the selected category; topItemIds are at least three
 * category items when the category has that many (usage first, then name).
 */
export function itemOutMatrix(
  transactions: Transaction[],
  items: InventoryItem[],
  daysForPage: number,
  options?: {
    category?: string;
    destination?: string | null;
    from?: string;
    to?: string;
  }
): ItemOutMatrix {
  const { from, to, span } = resolveWindow(daysForPage, options);
  const dates = dateKeysInclusive(from, to);
  const labels = dates.map((d) => periodAxisLabel(d, span));
  const categoryByItemId = itemCategoryMap(items);
  const selectedCategory = options?.category?.trim();

  const categoryItems = items.filter((item) => {
    if (!selectedCategory || selectedCategory === "all") return true;
    return (item.category?.trim() || "Uncategorized") === selectedCategory;
  });

  const outs = filterOutTransactions(transactions, {
    from,
    to,
    category: options?.category,
    categoryByItemId,
    destination: options?.destination,
  });

  const byItemId: Record<string, number[]> = {};
  for (const item of categoryItems) {
    byItemId[item.itemId] = dates.map(() => 0);
  }
  for (const tx of outs) {
    const day = transactionDateKey(tx.timestamp);
    const dayIndex = dates.indexOf(day);
    if (dayIndex < 0) continue;
    if (!byItemId[tx.itemId]) {
      byItemId[tx.itemId] = dates.map(() => 0);
    }
    byItemId[tx.itemId][dayIndex] += tx.quantity;
  }

  const categoryTotals = new Map<string, number>();
  for (const item of categoryItems) {
    const series = byItemId[item.itemId] ?? [];
    categoryTotals.set(
      item.itemId,
      series.reduce((sum, value) => sum + value, 0)
    );
  }

  const ranked = [...categoryItems].sort((a, b) => {
    const byUsage =
      (categoryTotals.get(b.itemId) ?? 0) - (categoryTotals.get(a.itemId) ?? 0);
    if (byUsage !== 0) return byUsage;
    return a.itemName.localeCompare(b.itemName);
  });
  const defaultCount = Math.min(COMPARE_DEFAULT_COUNT, ranked.length);
  const topItemIds = ranked.slice(0, defaultCount).map((item) => item.itemId);

  return { from, to, dates, labels, byItemId, topItemIds };
}

/** @deprecated Prefer itemOutMatrix */
export function weeklyItemOutMatrix(
  transactions: Transaction[],
  daysForPage: number
): ItemOutMatrix {
  return itemOutMatrix(transactions, [], daysForPage);
}
