import { formatNumber } from "./utils";
import { STOCK_DESTINATIONS, type InventoryItem, type StockDestination } from "./types";

export const SELECT_ITEM_MESSAGE = "Select an item from the list.";
export const QUANTITY_MESSAGE = "Enter a quantity greater than zero.";
export const CHOOSE_DESTINATION_MESSAGE = "Choose where this stock is going.";
export const ITEM_NOT_FOUND_MESSAGE =
  "That item is no longer on the inventory list. Search again.";
export const STOCK_SAVE_ROLLED_BACK_MESSAGE =
  "The movement could not be saved. Nothing was changed. Try again.";
export const STOCK_NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

export const STOCK_LOG_ROLLED_BACK = "LOG_FAILED_ROLLED_BACK";
export const STOCK_LOG_FAILED_SHEET_UPDATED = "LOG_FAILED_SHEET_UPDATED";

export function destinationNotAllowedMessage(): string {
  return `That destination is not allowed. Use ${STOCK_DESTINATIONS.join(", ")}.`;
}

export function stockLogFailedSheetMessage(itemName: string): string {
  return `${itemName} was updated on the item sheet, but the movement was not saved in the log. Do not enter it again.`;
}

export function isStockDestination(value: unknown): value is StockDestination {
  return (
    typeof value === "string" &&
    (STOCK_DESTINATIONS as readonly string[]).includes(value)
  );
}

/** Stock-out must name a destination. Empty is a missed choice, not Kitchen. */
export function stockDestinationError(destination: unknown): string | null {
  if (typeof destination !== "string" || destination.trim() === "") {
    return CHOOSE_DESTINATION_MESSAGE;
  }
  if (!isStockDestination(destination)) {
    return destinationNotAllowedMessage();
  }
  return null;
}

export class StockMovementError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "StockMovementError";
    this.code = code;
  }
}

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

export function movementQuantityError(quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return QUANTITY_MESSAGE;
  }
  return null;
}

export function insufficientStockMessage(
  item: InventoryItem,
  quantity: number
): string {
  const unit = item.unit.trim() || "units";
  return `Cannot remove ${formatNumber(quantity)} ${unit} of ${item.itemName}. Only ${formatNumber(item.closingStock)} ${unit} is available.`;
}

export function validateStockMovement(
  item: InventoryItem,
  type: "in" | "out",
  quantity: number
): string | null {
  const quantityError = movementQuantityError(quantity);
  if (quantityError) return quantityError;

  if (type === "out" && quantity > item.closingStock) {
    return insufficientStockMessage(item, quantity);
  }

  return null;
}
