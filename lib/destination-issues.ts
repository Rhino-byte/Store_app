import { transactionDateKey } from "@/lib/dates";
import { DEFAULT_STOCK_DESTINATION, type Transaction } from "@/lib/types";

/** Stock-out of one item to one destination on one calendar day. */
export type DestinationIssue = {
  destination: string;
  itemId: string;
  itemName: string;
  quantity: number;
  date: string;
};

export function groupDestinationIssues(
  transactions: Transaction[]
): DestinationIssue[] {
  const totals = new Map<string, DestinationIssue>();

  for (const tx of transactions) {
    if (tx.type !== "out") continue;
    const date = transactionDateKey(tx.timestamp);
    if (!date) continue;
    const destination = tx.destination?.trim() || DEFAULT_STOCK_DESTINATION;
    const key = `${destination}::${tx.itemId}::${date}`;
    const current = totals.get(key);
    if (current) {
      current.quantity += tx.quantity;
    } else {
      totals.set(key, {
        destination,
        itemId: tx.itemId,
        itemName: tx.itemName,
        quantity: tx.quantity,
        date,
      });
    }
  }

  return Array.from(totals.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (b.quantity !== a.quantity) return b.quantity - a.quantity;
    return a.itemName.localeCompare(b.itemName);
  });
}
