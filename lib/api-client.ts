import type {
  DailyInOutPoint,
  DailyItemSeries,
  DailyStockItem,
  DestinationTotal,
  InventoryOption,
  ItemOutMatrix,
  PeriodComparisonSeries,
  StockHealthSnapshot,
  UserActivitySeries,
} from "@/lib/analytics";
import type {
  DashboardStats,
  InventoryItem,
  StockDestination,
} from "@/lib/types";
import { getFirebaseAuthHeader } from "@/lib/auth/use-firebase-auth";

export type AnalyticsPayload = {
  stats: DashboardStats;
  stockHealth: StockHealthSnapshot;
  lowStockItems: InventoryItem[];
  categories: string[];
  destinations: string[];
  category: string;
  destination: string;
  inventoryOptions: InventoryOption[];
  dailyMovement: DailyInOutPoint[];
  destinationTotals: DestinationTotal[];
  topConsumedDaily: DailyItemSeries;
  periodComparison: PeriodComparisonSeries;
  itemOuts: ItemOutMatrix;
  userActivity: UserActivitySeries;
};

export async function fetchInventory(): Promise<InventoryItem[]> {
  const headers = await getFirebaseAuthHeader();
  const response = await fetch("/api/inventory", { headers, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load inventory");
  }
  return data.items;
}

export async function submitStockMovement(payload: {
  itemId: string;
  type: "in" | "out";
  quantity: number;
  notes?: string;
  destination?: StockDestination;
}) {
  const headers = await getFirebaseAuthHeader();
  const response = await fetch("/api/stock", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to update stock");
  }
  return data;
}

export async function fetchDailyStock(date?: string): Promise<{
  date: string;
  items: DailyStockItem[];
}> {
  const headers = await getFirebaseAuthHeader();
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const response = await fetch(`/api/daily-stock${query}`, {
    headers,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load daily stock");
  }
  return data;
}

export async function fetchReport(params: {
  period: "weekly" | "monthly" | "4months" | "custom";
  from?: string;
  to?: string;
}) {
  const headers = await getFirebaseAuthHeader();
  const search = new URLSearchParams({ period: params.period });
  if (params.period === "custom") {
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
  }
  const response = await fetch(`/api/reports?${search.toString()}`, {
    headers,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load report");
  }
  return data;
}

export async function fetchAnalytics(
  days: number,
  headers: HeadersInit,
  filters?: { category?: string; destination?: string }
): Promise<AnalyticsPayload> {
  const search = new URLSearchParams({ days: String(days) });
  if (filters?.category) search.set("category", filters.category);
  if (filters?.destination) search.set("destination", filters.destination);

  const response = await fetch(`/api/analytics?${search.toString()}`, {
    headers,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load analytics");
  }
  return data as AnalyticsPayload;
}

export async function createItem(
  payload: {
    itemName: string;
    category?: string;
    unit?: string;
    openingStock?: number;
    stockIn?: number;
    stockOut?: number;
    reorderLevel?: number | null;
    notes?: string;
  },
  headers: HeadersInit
) {
  const response = await fetch("/api/items", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to create item");
  }
  return data.item as InventoryItem;
}

export async function updateItem(
  payload: Record<string, unknown>,
  headers: HeadersInit
) {
  const response = await fetch("/api/items", {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to update item");
  }
  return data.item;
}

export async function sendTestAlert(headers: HeadersInit) {
  const response = await fetch("/api/alerts/test", {
    method: "POST",
    headers,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to send test alert");
  }
  return data;
}

export async function createStockAdjustment(
  payload: {
    itemId: string;
    direction: "in" | "out";
    quantity: number;
    reason: string;
  },
  headers: HeadersInit
) {
  const response = await fetch("/api/stock/adjust", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to adjust stock");
  }
  return data as {
    item: InventoryItem;
    correction: {
      timestamp: string;
      itemId: string;
      itemName: string;
      type: "in" | "out";
      quantity: number;
      userEmail: string;
      reason: string;
    };
    alertSent: boolean;
  };
}

export async function fetchStockAdjustments(limit = 100) {
  const headers = await getFirebaseAuthHeader();
  const response = await fetch(
    `/api/stock/adjustments?limit=${encodeURIComponent(String(limit))}`,
    { headers, cache: "no-store" }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load corrections");
  }
  return data.corrections as Array<{
    timestamp: string;
    itemId: string;
    itemName: string;
    type: "in" | "out";
    quantity: number;
    userEmail: string;
    reason: string;
  }>;
}
