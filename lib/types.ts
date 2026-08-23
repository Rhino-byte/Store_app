export interface InventoryItem {
  rowIndex: number;
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  openingStock: number;
  stockIn: number;
  stockOut: number;
  closingStock: number;
  reorderLevel: number | null;
  notes: string;
  price: number | null;
}

export type StockMovementType = "in" | "out";

export const STOCK_DESTINATIONS = [
  "Mum",
  "Hotel",
  "Kitchen",
  "House Keeping",
  "Order"
] as const;

export type StockDestination = (typeof STOCK_DESTINATIONS)[number];

export const DEFAULT_STOCK_DESTINATION: StockDestination = "Kitchen";

export interface StockMovementRequest {
  itemId: string;
  type: StockMovementType;
  quantity: number;
  notes?: string;
  /** Required for stock-out. Where items were taken. */
  destination?: StockDestination;
}

export interface Transaction {
  timestamp: string;
  itemId: string;
  itemName: string;
  type: StockMovementType;
  quantity: number;
  userEmail: string;
  notes: string;
  /** Empty for stock-in. Kitchen default when reading blank stock-out rows. */
  destination: string;
}

/** Admin stock correction logged on the Corrections sheet (not Transactions). */
export interface StockCorrection {
  timestamp: string;
  itemId: string;
  itemName: string;
  type: StockMovementType;
  quantity: number;
  userEmail: string;
  reason: string;
}

export interface StockAdjustRequest {
  itemId: string;
  direction: StockMovementType;
  quantity: number;
  reason: string;
}

export interface AlertLogEntry {
  itemId: string;
  lastAlertedAt: string;
  stockAtAlert: number;
}

export interface DashboardStats {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  todayMovements: number;
}

export interface ItemUpdateRequest {
  itemId: string;
  itemName?: string;
  category?: string;
  unit?: string;
  openingStock?: number;
  reorderLevel?: number | null;
  notes?: string;
  price?: number | null;
}

export interface ItemCreateRequest {
  itemName: string;
  category?: string;
  unit?: string;
  openingStock?: number;
  stockIn?: number;
  stockOut?: number;
  reorderLevel?: number | null;
  notes?: string;
  price?: number | null;
}
