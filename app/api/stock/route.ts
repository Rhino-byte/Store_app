import { NextResponse } from "next/server";
import { clearAlertIfRecovered, sendLowStockAlert } from "@/lib/alerts";
import { requireClerk } from "@/lib/auth/api-auth";
import {
  appendTransaction,
  getInventoryItemById,
  revertStockMovement,
  updateStockMovement,
} from "@/lib/sheets";
import {
  CHOOSE_DESTINATION_MESSAGE,
  ITEM_NOT_FOUND_MESSAGE,
  SELECT_ITEM_MESSAGE,
  STOCK_LOG_FAILED_SHEET_UPDATED,
  STOCK_LOG_ROLLED_BACK,
  STOCK_SAVE_ROLLED_BACK_MESSAGE,
  isStockDestination,
  movementQuantityError,
  stockDestinationError,
  stockLogFailedSheetMessage,
  validateStockMovement,
} from "@/lib/stock";
import type { StockMovementRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { email, uid } = await requireClerk(request);
    const body = (await request.json()) as StockMovementRequest;

    if (!body.itemId?.trim()) {
      return NextResponse.json({ error: SELECT_ITEM_MESSAGE }, { status: 400 });
    }

    if (body.type !== "in" && body.type !== "out") {
      return NextResponse.json({ error: "Invalid movement type." }, { status: 400 });
    }

    const quantity = Number(body.quantity);
    const quantityError = movementQuantityError(quantity);
    if (quantityError) {
      return NextResponse.json({ error: quantityError }, { status: 400 });
    }

    let destination = "";
    if (body.type === "out") {
      const destinationError = stockDestinationError(body.destination);
      if (destinationError || !isStockDestination(body.destination)) {
        return NextResponse.json(
          { error: destinationError ?? CHOOSE_DESTINATION_MESSAGE },
          { status: 400 }
        );
      }
      destination = body.destination;
    }

    const item = await getInventoryItemById(body.itemId);
    if (!item) {
      return NextResponse.json({ error: ITEM_NOT_FOUND_MESSAGE }, { status: 404 });
    }

    const validationError = validateStockMovement(item, body.type, quantity);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    let updatedItem;
    try {
      updatedItem = await updateStockMovement(item, body.type, quantity);
    } catch (error) {
      console.error("POST /api/stock sheet update failed", error);
      return NextResponse.json(
        {
          error: STOCK_SAVE_ROLLED_BACK_MESSAGE,
          code: STOCK_LOG_ROLLED_BACK,
        },
        { status: 500 }
      );
    }

    try {
      await appendTransaction({
        timestamp: new Date().toISOString(),
        itemId: updatedItem.itemId,
        itemName: updatedItem.itemName,
        type: body.type,
        quantity,
        userEmail: email ?? uid,
        notes: body.notes?.trim() ?? "",
        destination,
      });
    } catch (error) {
      console.error("POST /api/stock log append failed", error);
      try {
        await revertStockMovement(updatedItem, body.type, quantity);
      } catch (rollbackError) {
        console.error("POST /api/stock rollback failed", rollbackError);
        return NextResponse.json(
          {
            error: stockLogFailedSheetMessage(updatedItem.itemName),
            code: STOCK_LOG_FAILED_SHEET_UPDATED,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: STOCK_SAVE_ROLLED_BACK_MESSAGE,
          code: STOCK_LOG_ROLLED_BACK,
        },
        { status: 500 }
      );
    }

    let alertSent = false;
    try {
      await clearAlertIfRecovered(updatedItem);
      alertSent = await sendLowStockAlert(updatedItem);
    } catch (error) {
      console.error("POST /api/stock alert failed", error);
    }

    return NextResponse.json({ item: updatedItem, alertSent });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("POST /api/stock", error);
    return NextResponse.json(
      {
        error: STOCK_SAVE_ROLLED_BACK_MESSAGE,
        code: STOCK_LOG_ROLLED_BACK,
      },
      { status: 500 }
    );
  }
}
