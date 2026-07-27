import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  isDateKeyInRange,
  rollingDateRange,
  todayDateKey,
  transactionDateKey,
} from "@/lib/dates";
import { DEFAULT_STOCK_DESTINATION } from "@/lib/types";
import type { InventoryItem, Transaction } from "@/lib/types";

export type ReportPeriod = "weekly" | "monthly" | "4months" | "custom";

export const REPORT_PERIOD_DAYS: Record<Exclude<ReportPeriod, "custom">, number> = {
  weekly: 7,
  monthly: 30,
  "4months": 120,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_RANGE_DAYS = 366 * 2;

export { todayDateKey };

export function isValidDateKey(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

/** Inclusive rolling window: from = today - (days - 1), to = today. */
export function presetDateRange(
  days: number,
  now = new Date()
): { from: string; to: string } {
  return rollingDateRange(days, now);
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  fromKey: string,
  toKey: string
): Transaction[] {
  return transactions.filter((tx) => {
    const day = transactionDateKey(tx.timestamp);
    return isDateKeyInRange(day, fromKey, toKey);
  });
}

export function resolveReportRange(params: {
  period: ReportPeriod;
  from?: string | null;
  to?: string | null;
}): { from: string; to: string } | { error: string } {
  if (params.period === "custom") {
    const from = params.from?.trim() ?? "";
    const to = params.to?.trim() ?? "";
    if (!from || !to) {
      return { error: "Custom period requires from and to dates (YYYY-MM-DD)." };
    }
    if (!isValidDateKey(from) || !isValidDateKey(to)) {
      return { error: "Invalid date. Use YYYY-MM-DD." };
    }
    if (from > to) {
      return { error: "From date must be on or before the to date." };
    }
    const span = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
    if (span > MAX_CUSTOM_RANGE_DAYS) {
      return { error: "Custom range cannot exceed 2 years." };
    }
    return { from, to };
  }

  const days = REPORT_PERIOD_DAYS[params.period];
  return presetDateRange(days);
}

export type ReportStockInRow = {
  itemId: string;
  itemName: string;
  stockIn: number;
};

export type ReportStockOutRow = {
  itemId: string;
  itemName: string;
  stockOut: number;
  destination: string;
};

export type ReportStockBalanceRow = {
  itemId: string;
  itemName: string;
  unit: string;
  opening: number;
  stockIn: number;
  stockOut: number;
  total: number;
  closing: number;
};

export type ReportDestinationTotal = {
  destination: string;
  quantity: number;
};

/** Sheet row order keyed by Item ID (matches Google Sheet top-to-bottom). */
export function sheetItemOrder(items: InventoryItem[]): Map<string, number> {
  const order = new Map<string, number>();
  items.forEach((item, index) => {
    order.set(item.itemId, index);
  });
  return order;
}

function compareBySheetOrder(
  aId: string,
  bId: string,
  order: Map<string, number>
): number {
  const aIndex = order.get(aId);
  const bIndex = order.get(bId);
  if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
  if (aIndex !== undefined) return -1;
  if (bIndex !== undefined) return 1;
  return aId.localeCompare(bId, undefined, { numeric: true });
}

export function reportStockInTotals(
  transactions: Transaction[],
  items: InventoryItem[] = []
): ReportStockInRow[] {
  const order = sheetItemOrder(items);
  const totals = new Map<string, { itemName: string; stockIn: number }>();
  for (const tx of transactions) {
    if (tx.type !== "in") continue;
    const current = totals.get(tx.itemId) ?? { itemName: tx.itemName, stockIn: 0 };
    current.stockIn += tx.quantity;
    totals.set(tx.itemId, current);
  }
  return Array.from(totals.entries())
    .map(([itemId, values]) => ({
      itemId,
      itemName: values.itemName,
      stockIn: values.stockIn,
    }))
    .sort((a, b) => compareBySheetOrder(a.itemId, b.itemId, order));
}

export function reportStockOutTotals(
  transactions: Transaction[],
  items: InventoryItem[] = []
): ReportStockOutRow[] {
  const order = sheetItemOrder(items);
  const totals = new Map<
    string,
    { itemId: string; itemName: string; stockOut: number; destination: string }
  >();

  for (const tx of transactions) {
    if (tx.type !== "out") continue;
    const destination = tx.destination?.trim() || DEFAULT_STOCK_DESTINATION;
    const key = `${tx.itemId}::${destination}`;
    const current = totals.get(key) ?? {
      itemId: tx.itemId,
      itemName: tx.itemName,
      stockOut: 0,
      destination,
    };
    current.stockOut += tx.quantity;
    totals.set(key, current);
  }

  return Array.from(totals.values()).sort((a, b) => {
    const bySheet = compareBySheetOrder(a.itemId, b.itemId, order);
    if (bySheet !== 0) return bySheet;
    return a.destination.localeCompare(b.destination);
  });
}

export function reportDestinationTotals(
  transactions: Transaction[]
): ReportDestinationTotal[] {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "out") continue;
    const destination = tx.destination?.trim() || DEFAULT_STOCK_DESTINATION;
    totals.set(destination, (totals.get(destination) ?? 0) + tx.quantity);
  }
  return Array.from(totals.entries())
    .map(([destination, quantity]) => ({ destination, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
}

/**
 * Period stock balance:
 * Opening = sheet.openingStock + ins(before from) - outs(before from)
 * Stock In/Out = sums in [from, to]
 * Total = Opening + Stock In
 * Closing = Total - Stock Out
 *
 * Rows follow inventory sheet order (Item ID / row position).
 */
export function reportStockBalanceRows(
  items: InventoryItem[],
  allTransactions: Transaction[],
  fromKey: string,
  toKey: string
): ReportStockBalanceRow[] {
  const byItem = new Map<string, Transaction[]>();
  for (const tx of allTransactions) {
    if (!tx.timestamp || !tx.itemId) continue;
    const list = byItem.get(tx.itemId) ?? [];
    list.push(tx);
    byItem.set(tx.itemId, list);
  }

  // `items` from getInventoryItems() is already in sheet row order.
  return items.map((item) => {
    const txs = byItem.get(item.itemId) ?? [];
    let priorIn = 0;
    let priorOut = 0;
    let periodIn = 0;
    let periodOut = 0;

    for (const tx of txs) {
      const day = transactionDateKey(tx.timestamp);
      if (!day) continue;
      if (day < fromKey) {
        if (tx.type === "in") priorIn += tx.quantity;
        else if (tx.type === "out") priorOut += tx.quantity;
      } else if (day <= toKey) {
        if (tx.type === "in") periodIn += tx.quantity;
        else if (tx.type === "out") periodOut += tx.quantity;
      }
    }

    const opening = item.openingStock + priorIn - priorOut;
    const total = opening + periodIn;
    const closing = total - periodOut;

    return {
      itemId: item.itemId,
      itemName: item.itemName,
      unit: item.unit,
      opening,
      stockIn: periodIn,
      stockOut: periodOut,
      total,
      closing,
    };
  });
}
