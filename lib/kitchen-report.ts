import { transactionDateKey } from "@/lib/dates";
import type { InventoryItem, Transaction } from "@/lib/types";

export type KitchenPriorityItem = {
  key: string;
  label: string;
  unit: string;
  aliases: string[];
};

/** Kitchen daily sheet order. Items not listed stay off this report. */
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

export function buildKitchenDailyReport(
  items: InventoryItem[],
  transactions: Transaction[],
  dateKey: string
): KitchenDailyRow[] {
  const matched = matchKitchenInventory(items);
  const byItemId = new Map<
    string,
    { stockIn: number; stockOut: number; destinations: Set<string> }
  >();

  for (const tx of transactions) {
    if (!tx.timestamp || transactionDateKey(tx.timestamp) !== dateKey) continue;
    const current = byItemId.get(tx.itemId) ?? {
      stockIn: 0,
      stockOut: 0,
      destinations: new Set<string>(),
    };
    if (tx.type === "in") {
      current.stockIn += tx.quantity;
    } else {
      current.stockOut += tx.quantity;
      const dest = tx.destination?.trim();
      if (dest) current.destinations.add(dest);
    }
    byItemId.set(tx.itemId, current);
  }

  return KITCHEN_PRIORITY_ITEMS.map((slot) => {
    const item = matched.get(slot.key);
    if (!item) {
      return {
        key: slot.key,
        label: slot.label,
        unit: slot.unit,
        itemId: null,
        itemName: null,
        stockIn: 0,
        stockOut: 0,
        destination: "",
        matched: false,
      };
    }

    const movement = byItemId.get(item.itemId);
    return {
      key: slot.key,
      label: slot.label,
      unit: item.unit || slot.unit,
      itemId: item.itemId,
      itemName: item.itemName,
      stockIn: movement?.stockIn ?? 0,
      stockOut: movement?.stockOut ?? 0,
      destination: movement
        ? Array.from(movement.destinations).sort().join(", ")
        : "",
      matched: true,
    };
  });
}
