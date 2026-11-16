import { NextResponse } from "next/server";
import {
  buildDashboardStats,
  destinationBreakdown,
  destinationIssues,
  dailyInOutMovement,
  stockInReceipts,
  filterTransactionsByDays,
  inventoryOptions,
  itemOutMatrix,
  listCategories,
  stockHealthSnapshot,
  userActivityByDay,
} from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth/api-auth";
import { resolveCustomDateRange, rollingDateRange } from "@/lib/dates";
import { getInventoryItems, getTransactions } from "@/lib/sheets";
import { isLowStock } from "@/lib/stock";
import { STOCK_DESTINATIONS } from "@/lib/types";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") ?? 30);
    const fromParam = searchParams.get("from")?.trim() ?? "";
    const toParam = searchParams.get("to")?.trim() ?? "";

    let from: string;
    let to: string;
    if (fromParam && toParam) {
      const resolved = resolveCustomDateRange(fromParam, toParam);
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      from = resolved.from;
      to = resolved.to;
    } else {
      const span = days <= 0 ? 1 : days;
      const rolling = rollingDateRange(span);
      from = rolling.from;
      to = rolling.to;
    }
    const range = { from, to };

    const [items, transactions] = await Promise.all([
      getInventoryItems(),
      getTransactions(),
    ]);

    const categories = listCategories(items);
    const categoryParam = searchParams.get("category")?.trim() ?? "";
    const category =
      categoryParam && categories.includes(categoryParam)
        ? categoryParam
        : categories[0] ?? "Uncategorized";

    const destinationParam = searchParams.get("destination")?.trim() ?? "all";
    const destination =
      destinationParam === "all" ||
      (STOCK_DESTINATIONS as readonly string[]).includes(destinationParam)
        ? destinationParam
        : "all";

    const filtered = filterTransactionsByDays(transactions, days, range);

    return NextResponse.json({
      stats: buildDashboardStats(items, transactions),
      stockHealth: stockHealthSnapshot(items),
      lowStockItems: items.filter(isLowStock),
      categories,
      destinations: ["all", ...STOCK_DESTINATIONS],
      category,
      destination,
      from,
      to,
      inventoryOptions: inventoryOptions(items, category),
      dailyMovement: dailyInOutMovement(transactions, items, days, {
        category,
        destination,
        ...range,
      }),
      stockInReceipts: stockInReceipts(transactions, items, days, {
        category,
        ...range,
      }),
      destinationTotals: destinationBreakdown(transactions, items, days, {
        category,
        ...range,
      }),
      destinationIssues: destinationIssues(transactions, items, days, {
        category,
        ...range,
      }),
      itemOuts: itemOutMatrix(transactions, items, days, {
        category,
        destination,
        ...range,
      }),
      userActivity: userActivityByDay(filtered, days, {
        category,
        destination,
        items,
        ...range,
      }),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("GET /api/analytics", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load analytics" },
      { status: 500 }
    );
  }
}
