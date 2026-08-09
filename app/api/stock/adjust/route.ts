import { NextResponse } from "next/server";
import { clearAlertIfRecovered, sendLowStockAlert } from "@/lib/alerts";
import { requireAdmin } from "@/lib/auth/api-auth";
import {
  appendCorrection,
  getInventoryItemById,
  updateStockMovement,
} from "@/lib/sheets";
import { validateStockMovement } from "@/lib/stock";
import type { StockAdjustRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { email, uid } = await requireAdmin(request);
    const body = (await request.json()) as StockAdjustRequest;

    if (!body.itemId || !body.direction || body.quantity == null) {
      return NextResponse.json(
        { error: "itemId, direction, and quantity are required." },
        { status: 400 }
      );
    }

    if (body.direction !== "in" && body.direction !== "out") {
      return NextResponse.json(
        { error: "direction must be in or out." },
        { status: 400 }
      );
    }

    const reason = body.reason?.trim() ?? "";
    if (!reason) {
      return NextResponse.json(
        { error: "Reason is required for stock corrections." },
        { status: 400 }
      );
    }

    const item = await getInventoryItemById(body.itemId);
    if (!item) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    const validationError = validateStockMovement(
      item,
      body.direction,
      body.quantity
    );
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const updatedItem = await updateStockMovement(
      item,
      body.direction,
      body.quantity
    );

    const correction = {
      timestamp: new Date().toISOString(),
      itemId: updatedItem.itemId,
      itemName: updatedItem.itemName,
      type: body.direction,
      quantity: body.quantity,
      userEmail: email ?? uid,
      reason,
    };

    await appendCorrection(correction);

    await clearAlertIfRecovered(updatedItem);
    const alertSent = await sendLowStockAlert(updatedItem);

    return NextResponse.json({ item: updatedItem, correction, alertSent });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("POST /api/stock/adjust", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to adjust stock",
      },
      { status: 500 }
    );
  }
}
