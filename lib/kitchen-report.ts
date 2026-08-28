import { transactionDateKey } from "@/lib/dates";
import type { InventoryItem, StockCorrection, Transaction } from "@/lib/types";

export type KitchenPriorityItem = {
  key: string;
  label: string;
  unit: string;
  aliases: string[];
};

/** Seed defaults for a new KitchenReportItems sheet. After that, admins own the list. */
export const KITCHEN_PRIORITY_ITEMS: KitchenPriorityItem[] = [
  { key: "kuku", label: "Kuku", unit: "psc", aliases: ["kuku", "chicken"] },
  {
    key: "ugali",
    label: "Ugali",
    unit: "psc",
    aliases: ["ugali", "maize flour"],
  },
  {
    key: "ngano",
    label: "Ngano",
    unit: "psc",
    aliases: ["ngano", "baking flour", "wheat flour"],
  },
  { key: "sugar", label: "Sugar", unit: "kg", aliases: ["sugar"] },
  { key: "rice", label: "Rice", unit: "kg", aliases: ["rice"] },
  { key: "milk", label: "Milk", unit: "ltr", aliases: ["milk"] },
  { key: "meat", label: "Meat", unit: "kg", aliases: ["meat", "beef"] },
  { key: "managu", label: "Managu", unit: "kg", aliases: ["managu"] },
  { key: "eggs", label: "Eggs", unit: "psc", aliases: ["eggs", "egg"] },
  { key: "beans", label: "Beans", unit: "kg", aliases: ["beans"] },
  { key: "minji", label: "Minji", unit: "kg", aliases: ["minji"] },
  { key: "matumbo", label: "Matumbo", unit: "kg", aliases: ["matumbo"] },
  { key: "onions", label: "Onions", unit: "", aliases: ["onions", "onion"] },
  {
    key: "nyanya",
    label: "Nyanya",
    unit: "",
    aliases: ["nyanya", "tomatoes", "tomato"],
  },
  { key: "cabbage", label: "Cabbage", unit: "", aliases: ["cabbage"] },
  {
    key: "cooking-fat",
    label: "Cooking Fat",
    unit: "",
    aliases: ["cooking fat"],
  },
];

export type KitchenDailyRow = {
  key: string;
  label: string;
  unit: string;
  itemId: string | null;
  itemName: string | null;
  stockIn: number;
  stockOut: number;
  closingStock: number | null;
  destination: string;
  matched: boolean;
};

export function formatKitchenReportHourLabel(hourEat: number): string {
  const hour = Math.min(23, Math.max(0, Math.trunc(hourEat)));
  return `${String(hour).padStart(2, "0")}:00 EAT`;
}

export function formatKitchenReportDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

export function normalizeItemName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchScore(normalizedName: string, aliases: string[]): number {
  for (const alias of aliases) {
    if (normalizedName === alias) return 3;
  }
  for (const alias of aliases) {
    if (
      normalizedName.startsWith(`${alias} `) ||
      normalizedName.endsWith(` ${alias}`)
    ) {
      return 2;
    }
  }
  return 0;
}

export function matchKitchenInventory(
  items: InventoryItem[]
): Map<string, InventoryItem> {
  const unused = [...items];
  const matched = new Map<string, InventoryItem>();

  for (const slot of KITCHEN_PRIORITY_ITEMS) {
    let bestIndex = -1;
    let bestScore = 0;
    unused.forEach((item, index) => {
      const score = matchScore(normalizeItemName(item.itemName), slot.aliases);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) {
      matched.set(slot.key, unused[bestIndex]);
      unused.splice(bestIndex, 1);
    }
  }

  return matched;
}

/** Item IDs from the hardcoded kitchen list that match current inventory. */
export function seedKitchenReportItemIds(items: InventoryItem[]): string[] {
  const matched = matchKitchenInventory(items);
  const ids: string[] = [];
  for (const slot of KITCHEN_PRIORITY_ITEMS) {
    const item = matched.get(slot.key);
    if (item) ids.push(item.itemId);
  }
  return ids;
}

type KitchenMovement = {
  stockIn: number;
  stockOut: number;
  throughIn: number;
  throughOut: number;
  destinations: Set<string>;
};

function emptyMovement(): KitchenMovement {
  return {
    stockIn: 0,
    stockOut: 0,
    throughIn: 0,
    throughOut: 0,
    destinations: new Set<string>(),
  };
}

function applyKitchenQuantity(
  byItemId: Map<string, KitchenMovement>,
  entry: {
    timestamp: string;
    itemId: string;
    type: "in" | "out";
    quantity: number;
    destination?: string;
  },
  dateKey: string,
  includeInDayTotals: boolean
) {
  const day = transactionDateKey(entry.timestamp);
  if (!day || !entry.itemId || day > dateKey) return;

  const current = byItemId.get(entry.itemId) ?? emptyMovement();
  if (entry.type === "in") {
    current.throughIn += entry.quantity;
    if (includeInDayTotals && day === dateKey) current.stockIn += entry.quantity;
  } else {
    current.throughOut += entry.quantity;
    if (includeInDayTotals && day === dateKey) {
      current.stockOut += entry.quantity;
      const dest = entry.destination?.trim();
      if (dest) current.destinations.add(dest);
    }
  }
  byItemId.set(entry.itemId, current);
}

export function buildKitchenDailyReport(
  items: InventoryItem[],
  transactions: Transaction[],
  dateKey: string,
  corrections: StockCorrection[] = [],
  reportItems: Array<{ itemId: string; itemName?: string }> = []
): KitchenDailyRow[] {
  const inventoryById = new Map(items.map((item) => [item.itemId, item]));
  const byItemId = new Map<string, KitchenMovement>();

  for (const tx of transactions) {
    applyKitchenQuantity(
      byItemId,
      {
        timestamp: tx.timestamp,
        itemId: tx.itemId,
        type: tx.type,
        quantity: tx.quantity,
        destination: tx.destination,
      },
      dateKey,
      true
    );
  }

  for (const corr of corrections) {
    applyKitchenQuantity(
      byItemId,
      {
        timestamp: corr.timestamp,
        itemId: corr.itemId,
        type: corr.type,
        quantity: corr.quantity,
      },
      dateKey,
      false
    );
  }

  return reportItems.map((ref) => {
    const item = inventoryById.get(ref.itemId);
    if (!item) {
      const fallbackName = ref.itemName?.trim() || ref.itemId;
      return {
        key: ref.itemId,
        label: fallbackName,
        unit: "",
        itemId: ref.itemId,
        itemName: ref.itemName?.trim() || null,
        stockIn: 0,
        stockOut: 0,
        closingStock: null,
        destination: "",
        matched: false,
      };
    }

    const movement = byItemId.get(item.itemId);
    return {
      key: item.itemId,
      label: item.itemName,
      unit: item.unit,
      itemId: item.itemId,
      itemName: item.itemName,
      stockIn: movement?.stockIn ?? 0,
      stockOut: movement?.stockOut ?? 0,
      closingStock:
        item.openingStock +
        (movement?.throughIn ?? 0) -
        (movement?.throughOut ?? 0),
      destination: movement
        ? Array.from(movement.destinations).sort().join(", ")
        : "",
      matched: true,
    };
  });
}
