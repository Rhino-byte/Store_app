import { NextResponse } from "next/server";
import {
  buildDashboardStats,
  dailyMovementTotals,
  filterTransactionsByDays,
  groupStockByCategory,
  inventoryOptions,
  itemMovementTotals,
  listCategories,
  periodComparisonByAllCategories,
  topConsumedDailyByAllCategories,
  topConsumedItems,
  userActivityByDay,
  weeklyItemOutMatrix,
} from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth/api-auth";
import { getInventoryItems, getTransactions } from "@/lib/sheets";
import { isLowStock } from "@/lib/stock";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") ?? 30);

    const [items, transactions] = await Promise.all([
      getInventoryItems(),
      getTransactions(),
    ]);

    const filtered = filterTransactionsByDays(transactions, days);

    return NextResponse.json({
      stats: buildDashboardStats(items, transactions),
      lowStockItems: items.filter(isLowStock),
      categoryStock: groupStockByCategory(items),
      topConsumed: topConsumedItems(filtered),
      dailyMovement: dailyMovementTotals(filtered),
      itemMovement: itemMovementTotals(filtered),
      userActivity: userActivityByDay(filtered, days),
      transactions: filtered,
      categories: listCategories(items),
      inventoryOptions: inventoryOptions(items),
      topConsumedDailyByCategory: topConsumedDailyByAllCategories(
        transactions,
        items,
        days,
        5
      ),
      periodComparisonByCategory: periodComparisonByAllCategories(
        transactions,
        items,
        days
      ),
      weeklyItemOuts: weeklyItemOutMatrix(transactions, days),
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
