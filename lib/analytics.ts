import {
  dateKeysInclusive,
  isDateKeyInRange,
  previousRollingDateRange,
  rollingDateRange,
  todayDateKey,
  transactionDateKey,
} from "@/lib/dates";
import type { DashboardStats, InventoryItem, Transaction } from "./types";
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

function itemCategoryMap(items: InventoryItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.itemId, item.category?.trim() || "Uncategorized");
  }
  return map;
}

function filterOutTransactions(
  transactions: Transaction[],
  options?: {
    from?: string;
    to?: string;
    itemIds?: Set<string>;
    category?: string;
    categoryByItemId?: Map<string, string>;
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
    return true;
  });
}

function weekdayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAY_LABELS[utc.getUTCDay()];
}

function periodAxisLabel(dateKey: string, index: number, span: number): string {
  if (span <= 7) return weekdayLabel(dateKey);
  if (span <= 31) return dateKey.slice(5); // MM-DD
  return `Day ${index + 1}`;
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

export type DailyStockItem = {
  itemId: string;
  itemName: string;
  stockIn: number;
  stockOut: number;
  destination: string;
};

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
      const dest = tx.destination?.trim();
      if (dest) {
        current.destinations.add(dest);
      }
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

export type UserActivitySeries = {
  users: string[];
  points: Array<Record<string, string | number>>;
};

/**
 * Count of transactions per userEmail per calendar day.
 * Window matches filterTransactionsByDays (inclusive app-timezone days).
 */
export function userActivityByDay(
  transactions: Transaction[],
  days: number
): UserActivitySeries {
  const span = days <= 0 ? 1 : days;
  const { from, to } = rollingDateRange(span);
  const dayKeys = dateKeysInclusive(from, to);

  const usersSet = new Set<string>();
  const counts = new Map<string, Map<string, number>>();

  for (const day of dayKeys) {
    counts.set(day, new Map());
  }

  for (const tx of transactions) {
    if (!tx.timestamp) continue;
    const day = transactionDateKey(tx.timestamp);
    if (!counts.has(day)) continue;
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

export function inventoryOptions(items: InventoryItem[]): InventoryOption[] {
  return items
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
 * Optional category filters both current and previous windows.
 */
export function periodComparisonSeries(
  transactions: Transaction[],
  days: number,
  options?: { category?: string; items?: InventoryItem[] }
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

  const labels = currentKeys.map((key, index) =>
    periodAxisLabel(key, index, span)
  );

  const points = labels.map((label, index) => ({
    label,
    current: current[index] ?? 0,
    previous: previous[index] ?? 0,
  }));

  return { labels, current, previous, points };
}

/**
 * Top N consumed items in a category (or all), with daily out series.
 */
export function topConsumedDailyByCategory(
  transactions: Transaction[],
  items: InventoryItem[],
  options: {
    category?: string;
    from: string;
    to: string;
    limit?: number;
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
    new Map(ranked.map((r) => [r.itemId, r.itemName]))
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
  namesById?: Map<string, string>
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
  const points = dayKeys.map((date, index) => {
    const row: Record<string, string | number> = {
      date,
      label: periodAxisLabel(date, index, span),
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
 * Build top-consumed daily series for "all" plus each category so the client
 * can switch category without re-fetching.
 */
export function topConsumedDailyByAllCategories(
  transactions: Transaction[],
  items: InventoryItem[],
  days: number,
  limit = 5
): Record<string, DailyItemSeries> {
  const span = days <= 0 ? 1 : days;
  const { from, to } = rollingDateRange(span);
  const categories = ["all", ...listCategories(items)];
  const result: Record<string, DailyItemSeries> = {};
  for (const category of categories) {
    result[category] = topConsumedDailyByCategory(transactions, items, {
      category,
      from,
      to,
      limit,
    });
  }
  return result;
}

/**
 * Period comparison for "all" plus each category for snappy category switching.
 */
export function periodComparisonByAllCategories(
  transactions: Transaction[],
  items: InventoryItem[],
  days: number
): Record<string, PeriodComparisonSeries> {
  const categories = ["all", ...listCategories(items)];
  const result: Record<string, PeriodComparisonSeries> = {};
  for (const category of categories) {
    result[category] = periodComparisonSeries(transactions, days, {
      category,
      items,
    });
  }
  return result;
}

export type WeeklyItemOutMatrix = {
  from: string;
  to: string;
  dates: string[];
  labels: string[];
  /** Daily out quantities aligned to `dates`, only items with any activity. */
  byItemId: Record<string, number[]>;
};

/** Last-7-days (or today-only) sparse matrix for multi-item comparison. */
export function weeklyItemOutMatrix(
  transactions: Transaction[],
  daysForPage: number
): WeeklyItemOutMatrix {
  // Follow page range when today or 7 days; otherwise always last 7 days.
  const span = daysForPage === 0 ? 1 : 7;
  const { from, to } = rollingDateRange(span);
  const dates = dateKeysInclusive(from, to);
  const labels = dates.map((d) => weekdayLabel(d));
  const byItemId: Record<string, number[]> = {};

  for (const tx of transactions) {
    if (tx.type !== "out") continue;
    const day = transactionDateKey(tx.timestamp);
    const dayIndex = dates.indexOf(day);
    if (dayIndex < 0) continue;
    if (!byItemId[tx.itemId]) {
      byItemId[tx.itemId] = dates.map(() => 0);
    }
    byItemId[tx.itemId][dayIndex] += tx.quantity;
  }

  return { from, to, dates, labels, byItemId };
}
