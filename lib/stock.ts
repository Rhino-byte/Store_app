import type { InventoryItem } from "./types";

export function calculateClosingStock(
  openingStock: number,
  stockIn: number,
  stockOut: number
): number {
  return openingStock + stockIn - stockOut;
}

export function parseSheetNumber(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseOptionalNumber(
  value: string | number | undefined
): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isLowStock(item: InventoryItem): boolean {
  if (item.reorderLevel === null) return false;
  return item.closingStock <= item.reorderLevel;
}

export function isOutOfStock(item: InventoryItem): boolean {
  return item.closingStock <= 0;
}

/** Increment a trailing number on an ID, preserving prefix and zero-padding. */
export function incrementItemId(itemId: string): string {
  const match = itemId.trim().match(/^(.*?)(\d+)$/);
  if (!match) {
    return "1";
  }
  const prefix = match[1];
  const digits = match[2];
  const next = String(Number(digits) + 1).padStart(digits.length, "0");
  return `${prefix}${next}`;
}

export function previewNextItemId(
  items: Array<{ itemId: string; rowIndex: number }>
): string {
  if (items.length === 0) {
    return "1";
  }

  const lastItem = items.reduce((latest, item) =>
    item.rowIndex > latest.rowIndex ? item : latest
  );

  let candidate = incrementItemId(lastItem.itemId);
  const existing = new Set(items.map((item) => item.itemId));
  while (existing.has(candidate)) {
    candidate = incrementItemId(candidate);
  }
  return candidate;
}

export function validateStockMovement(
  item: InventoryItem,
  type: "in" | "out",
  quantity: number
): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity must be greater than zero.";
  }

  if (type === "out" && quantity > item.closingStock) {
    return `Cannot remove ${quantity} ${item.unit}. Only ${item.closingStock} available.`;
  }

  return null;
}
