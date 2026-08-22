import { NextResponse } from "next/server";
import {
  checkAllItemsForAlerts,
  isKitchenReportCronEnabled,
  sendKitchenDailyReportEmail,
} from "@/lib/alerts";
import { yesterdayDateKey } from "@/lib/dates";
import { buildKitchenDailyReport } from "@/lib/kitchen-report";
import { getInventoryItems, getTransactions } from "@/lib/sheets";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const kitchenDate = yesterdayDateKey();
    const items = await getInventoryItems();

    let kitchenSent = false;
    let kitchenSkipped: string | null = null;

    if (!isKitchenReportCronEnabled()) {
      kitchenSkipped = "disabled";
    } else {
      try {
        const transactions = await getTransactions();
        const rows = buildKitchenDailyReport(items, transactions, kitchenDate);
        await sendKitchenDailyReportEmail(kitchenDate, rows);
        kitchenSent = true;
      } catch (error) {
        console.error("Kitchen daily report email failed", error);
        kitchenSkipped =
          error instanceof Error ? error.message : "send_failed";
      }
    }

    const alertsSent = await checkAllItemsForAlerts(items);
    return NextResponse.json({
      kitchenDate,
      kitchenSent,
      kitchenSkipped,
      alertsSent,
      checked: items.length,
    });
  } catch (error) {
    console.error("GET /api/cron/check-stock", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}
