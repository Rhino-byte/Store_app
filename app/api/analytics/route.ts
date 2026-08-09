import { NextResponse } from "next/server";
import {
  buildDashboardStats,
  destinationBreakdown,
  dailyInOutMovement,
  filterTransactionsByDays,
  inventoryOptions,
  itemOutMatrix,
  listCategories,
  periodComparisonSeries,
  stockHealthSnapshot,
  topConsumedDailyForFilters,
  userActivityByDay,
} from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth/api-auth";
import { getInventoryItems, getTransactions } from "@/lib/sheets";
import { isLowStock } from "@/lib/stock";
import { STOCK_DESTINATIONS } from "@/lib/types";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") ?? 30);

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

    const filtered = filterTransactionsByDays(transactions, days);

    return NextResponse.json({
      stats: buildDashboardStats(items, transactions),
      stockHealth: stockHealthSnapshot(items),
      lowStockItems: items.filter(isLowStock),
      categories,
      destinations: ["all", ...STOCK_DESTINATIONS],
      category,
      destination,
      inventoryOptions: inventoryOptions(items, category),
      dailyMovement: dailyInOutMovement(transactions, items, days, {
        category,
        destination,
      }),
      destinationTotals: destinationBreakdown(transactions, items, days, {
        category,
      }),
      topConsumedDaily: topConsumedDailyForFilters(transactions, items, days, {
        category,
        destination,
        limit: 5,
      }),
      periodComparison: periodComparisonSeries(transactions, days, {
        category,
        items,
        destination,
      }),
      itemOuts: itemOutMatrix(transactions, items, days, {
        category,
        destination,
      }),
      userActivity: userActivityByDay(filtered, days, {
        category,
        destination,
        items,
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
