import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-auth";
import { todayDateKey } from "@/lib/dates";
import { buildKitchenDailyReport } from "@/lib/kitchen-report";
import { isValidDateKey } from "@/lib/reports";
import { getCorrections, getInventoryItems, getKitchenReportItems, getTransactions } from "@/lib/sheets";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("date")?.trim() ?? todayDateKey();

    if (!isValidDateKey(requested)) {
      return NextResponse.json(
        { error: "Invalid date. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const [items, transactions, corrections, reportItems] = await Promise.all([
      getInventoryItems(),
      getTransactions(),
      getCorrections(),
      getKitchenReportItems(),
    ]);

    const rows = buildKitchenDailyReport(
      items,
      transactions,
      requested,
      corrections,
      reportItems
    );

    return NextResponse.json({
      date: requested,
      rows,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("GET /api/reports/kitchen", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load kitchen report",
      },
      { status: 500 }
    );
  }
}
