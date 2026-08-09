import {
  dateKeysInclusive,
  isDateKeyInRange,
  previousRollingDateRange,
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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type InventoryOption = {
  itemId: string;
  itemName: string;
  category: string;
};

export type DailyItemSeries = {
  items: Array<{ itemId: string; itemName: string }>;
  points: Array<Record<string, string | number>>;
};

export type PeriodComparisonSeries = {
  labels: string[];
  current: number[];
  previous: number[];
  points: Array<{
    label: string;
    current: number;
    previous: number;
  }>;
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
  days: number
): Transaction[] {
  const span = days <= 0 ? 1 : days;
  const { from, to } = rollingDateRange(span);
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
  options?: { category?: string; destination?: string | null }
): DailyInOutPoint[] {
  const span = days <= 0 ? 1 : days;
  const { from, to } = rollingDateRange(span);
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
  options?: { category?: string }
): DestinationTotal[] {
  const span = days <= 0 ? 1 : days;
  const { from, to } = rollingDateRange(span);
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
  options?: { destination?: string | null; category?: string; items?: InventoryItem[] }
): UserActivitySeries {
  const span = days <= 0 ? 1 : days;
  const { from, to } = rollingDateRange(span);
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

/**
 * Total stock-out quantity per calendar day in [from, to], 0-filled.
 */
export function dailyOutTotals(
  transactions: Transaction[],
  from: string,
  to: string,
  options?: {
    category?: string;
    items?: InventoryItem[];
    itemIds?: string[];
    destination?: string | null;
  }
): number[] {
  const dayKeys = dateKeysInclusive(from, to);
  if (!dayKeys.length) return [];

  const categoryByItemId = options?.items
    ? itemCategoryMap(options.items)
    : undefined;
  const itemIdSet = options?.itemIds ? new Set(options.itemIds) : undefined;

  const outs = filterOutTransactions(transactions, {
    from,
    to,
    itemIds: itemIdSet,
    category: options?.category,
    categoryByItemId,
    destination: options?.destination,
  });

  const byDay = new Map<string, number>();
  for (const day of dayKeys) byDay.set(day, 0);
  for (const tx of outs) {
    const day = transactionDateKey(tx.timestamp);
    if (!byDay.has(day)) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + tx.quantity);
  }

  return dayKeys.map((day) => byDay.get(day) ?? 0);
}

/**
 * Dual-series period comparison aligned by day-of-window index.
 */
export function periodComparisonSeries(
  transactions: Transaction[],
  days: number,
  options?: {
    category?: string;
    items?: InventoryItem[];
    destination?: string | null;
  }
): PeriodComparisonSeries {
  const span = days <= 0 ? 1 : days;
  const currentRange = rollingDateRange(span);
  const previousRange = previousRollingDateRange(span);
  const currentKeys = dateKeysInclusive(currentRange.from, currentRange.to);

  const current = dailyOutTotals(
    transactions,
    currentRange.from,
    currentRange.to,
    options
  );
  const previous = dailyOutTotals(
    transactions,
    previousRange.from,
    previousRange.to,
    options
  );

  const labels = currentKeys.map((key) => periodAxisLabel(key, span));

  const points = labels.map((label, index) => ({
    label,
    current: current[index] ?? 0,
    previous: previous[index] ?? 0,
  }));

  return { labels, current, previous, points };
}

/**
 * Top N consumed items in a category, with daily out series.
 */
export function topConsumedDailyByCategory(
  transactions: Transaction[],
  items: InventoryItem[],
  options: {
    category?: string;
    from: string;
    to: string;
    limit?: number;
    destination?: string | null;
  }
): DailyItemSeries {
  const limit = options.limit ?? 5;
  const categoryByItemId = itemCategoryMap(items);
  const category = options.category?.trim() || "all";

  const outs = filterOutTransactions(transactions, {
    from: options.from,
    to: options.to,
    category,
    categoryByItemId,
    destination: options.destination,
  });

  const totals = new Map<string, { itemName: string; quantity: number }>();
  for (const tx of outs) {
    const current = totals.get(tx.itemId) ?? {
      itemName: tx.itemName,
      quantity: 0,
    };
    current.quantity += tx.quantity;
    if (tx.itemName) current.itemName = tx.itemName;
    totals.set(tx.itemId, current);
  }

  const ranked = Array.from(totals.entries())
    .map(([itemId, data]) => ({ itemId, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);

  return itemDailyOutSeries(
    transactions,
    ranked.map((r) => r.itemId),
    options.from,
    options.to,
    new Map(ranked.map((r) => [r.itemId, r.itemName])),
    options.destination
  );
}

/**
 * Daily stock-out series for specific item IDs over [from, to].
 */
export function itemDailyOutSeries(
  transactions: Transaction[],
  itemIds: string[],
  from: string,
  to: string,
  namesById?: Map<string, string>,
  destination?: string | null
): DailyItemSeries {
  const dayKeys = dateKeysInclusive(from, to);
  const idSet = new Set(itemIds);
  if (!itemIds.length || !dayKeys.length) {
    return { items: [], points: [] };
  }

  const nameMap = new Map<string, string>(namesById);
  const daily = new Map<string, Map<string, number>>();
  for (const day of dayKeys) {
    daily.set(day, new Map());
  }

  for (const tx of transactions) {
    if (tx.type !== "out" || !idSet.has(tx.itemId)) continue;
    if (!matchesDestination(tx, destination)) continue;
    const day = transactionDateKey(tx.timestamp);
    if (!daily.has(day)) continue;
    if (tx.itemName) nameMap.set(tx.itemId, tx.itemName);
    const dayMap = daily.get(day)!;
    dayMap.set(tx.itemId, (dayMap.get(tx.itemId) ?? 0) + tx.quantity);
  }

  const seriesItems = itemIds.map((itemId) => ({
    itemId,
    itemName: nameMap.get(itemId) ?? itemId,
  }));

  const span = dayKeys.length;
  const points = dayKeys.map((date) => {
    const row: Record<string, string | number> = {
      date,
      label: periodAxisLabel(date, span),
    };
    const dayMap = daily.get(date)!;
    for (const itemId of itemIds) {
      row[itemId] = dayMap.get(itemId) ?? 0;
    }
    return row;
  });

  return { items: seriesItems, points };
}

/**
 * Item out matrix for compare chart.
 * Span: today→1, 7→7, else min(pageDays, 30) for readability.
 */
export function itemOutMatrix(
  transactions: Transaction[],
  items: InventoryItem[],
  daysForPage: number,
  options?: { category?: string; destination?: string | null }
): ItemOutMatrix {
  const span =
    daysForPage === 0 ? 1 : daysForPage === 7 ? 7 : Math.min(daysForPage, 30);
  const { from, to } = rollingDateRange(span);
  const dates = dateKeysInclusive(from, to);
  const labels = dates.map((d) => periodAxisLabel(d, span));
  const categoryByItemId = itemCategoryMap(items);

  const outs = filterOutTransactions(transactions, {
    from,
    to,
    category: options?.category,
    categoryByItemId,
    destination: options?.destination,
  });

  const byItemId: Record<string, number[]> = {};
  const totals = new Map<string, number>();

  for (const tx of outs) {
    const day = transactionDateKey(tx.timestamp);
    const dayIndex = dates.indexOf(day);
    if (dayIndex < 0) continue;
    if (!byItemId[tx.itemId]) {
      byItemId[tx.itemId] = dates.map(() => 0);
    }
    byItemId[tx.itemId][dayIndex] += tx.quantity;
    totals.set(tx.itemId, (totals.get(tx.itemId) ?? 0) + tx.quantity);
  }

  const topItemIds = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([itemId]) => itemId);

  return { from, to, dates, labels, byItemId, topItemIds };
}

/** @deprecated Prefer itemOutMatrix */
export function weeklyItemOutMatrix(
  transactions: Transaction[],
  daysForPage: number
): ItemOutMatrix {
  return itemOutMatrix(transactions, [], daysForPage);
}

export function topConsumedDailyForFilters(
  transactions: Transaction[],
  items: InventoryItem[],
  days: number,
  options: { category: string; destination?: string | null; limit?: number }
): DailyItemSeries {
  const span = days <= 0 ? 1 : days;
  const { from, to } = rollingDateRange(span);
  return topConsumedDailyByCategory(transactions, items, {
    category: options.category,
    from,
    to,
    limit: options.limit ?? 5,
    destination: options.destination,
  });
}
