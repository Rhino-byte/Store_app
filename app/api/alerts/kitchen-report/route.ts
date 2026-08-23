import { NextResponse } from "next/server";
import {
  getKitchenReportHourEat,
  isKitchenReportCronEnabled,
  sendKitchenDailyReportEmail,
} from "@/lib/alerts";
import { requireAdmin } from "@/lib/auth/api-auth";
import { yesterdayDateKey } from "@/lib/dates";
import { buildKitchenDailyReport } from "@/lib/kitchen-report";
import { isValidDateKey } from "@/lib/reports";
import { getCorrections, getInventoryItems, getTransactions } from "@/lib/sheets";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({
      hourEat: getKitchenReportHourEat(),
      cronEnabled: isKitchenReportCronEnabled(),
      defaultDate: yesterdayDateKey(),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("GET /api/alerts/kitchen-report", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load kitchen report schedule",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("date")?.trim() ?? yesterdayDateKey();

    if (!isValidDateKey(requested)) {
      return NextResponse.json(
        { error: "Invalid date. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const [items, transactions, corrections] = await Promise.all([
      getInventoryItems(),
      getTransactions(),
      getCorrections(),
    ]);
    const rows = buildKitchenDailyReport(
      items,
      transactions,
      requested,
      corrections
    );
    await sendKitchenDailyReportEmail(requested, rows);

    return NextResponse.json({ success: true, date: requested });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("POST /api/alerts/kitchen-report", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send kitchen report",
      },
      { status: 500 }
    );
  }
}
