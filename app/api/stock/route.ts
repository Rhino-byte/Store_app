import { NextResponse } from "next/server";
import { clearAlertIfRecovered, sendLowStockAlert } from "@/lib/alerts";
import { requireClerk } from "@/lib/auth/api-auth";
import {
  appendTransactions,
  getInventoryItems,
  revertStockMovement,
  updateStockMovement,
} from "@/lib/sheets";
import {
  ITEM_NOT_FOUND_MESSAGE,
  STOCK_LOG_FAILED_SHEET_UPDATED,
  STOCK_LOG_ROLLED_BACK,
  STOCK_SAVE_ROLLED_BACK_MESSAGE,
  isStockDestination,
  stockLogFailedItemsMessage,
  validateStockBatch,
  type StockLineInput,
} from "@/lib/stock";
import type {
  InventoryItem,
  StockMovementBatchRequest,
  StockMovementRequest,
  StockMovementType,
  Transaction,
} from "@/lib/types";

type StockPostBody = Partial<StockMovementRequest> &
  Partial<StockMovementBatchRequest>;

type PreparedLine = {
  item: InventoryItem;
  quantity: number;
  destination: string;
};

type AppliedStep = {
  updated: InventoryItem;
  quantity: number;
};

function readRawLines(body: StockPostBody): StockLineInput[] {
  if (Array.isArray(body.lines)) {
    return body.lines.map((line) => ({
      itemId: String(line?.itemId ?? "").trim(),
      quantity: Number(line?.quantity),
      destination: line?.destination,
    }));
  }

  return [
    {
      itemId: String(body.itemId ?? "").trim(),
      quantity: Number(body.quantity),
      destination: body.destination,
    },
  ];
}

async function revertApplied(
  applied: AppliedStep[],
  type: StockMovementType
): Promise<boolean> {
  for (let index = applied.length - 1; index >= 0; index -= 1) {
    const step = applied[index];
    try {
      await revertStockMovement(step.updated, type, step.quantity);
    } catch (error) {
      console.error("POST /api/stock rollback failed", error);
      return false;
    }
  }
  return true;
}

function rolledBackResponse() {
  return NextResponse.json(
    {
      error: STOCK_SAVE_ROLLED_BACK_MESSAGE,
      code: STOCK_LOG_ROLLED_BACK,
    },
    { status: 500 }
  );
}

function sheetUpdatedResponse(itemNames: string[]) {
  return NextResponse.json(
    {
      error: stockLogFailedItemsMessage(itemNames),
      code: STOCK_LOG_FAILED_SHEET_UPDATED,
    },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  try {
    const { email, uid } = await requireClerk(request);
    const body = (await request.json()) as StockPostBody;

    if (body.type !== "in" && body.type !== "out") {
      return NextResponse.json({ error: "Invalid movement type." }, { status: 400 });
    }
    const movementType: StockMovementType = body.type;

    const parsed = readRawLines(body);
    const inventory = await getInventoryItems();
    const validationError = validateStockBatch(inventory, movementType, parsed);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: validationError === ITEM_NOT_FOUND_MESSAGE ? 404 : 400 }
      );
    }

    const byId = new Map(inventory.map((item) => [item.itemId, item]));
    const prepared: PreparedLine[] = parsed.map((line) => ({
      item: byId.get(line.itemId)!,
      quantity: line.quantity,
      destination:
        movementType === "out" && isStockDestination(line.destination)
          ? line.destination
          : "",
    }));

    const working = new Map<string, InventoryItem>();
    for (const line of prepared) {
      if (!working.has(line.item.itemId)) {
        working.set(line.item.itemId, line.item);
      }
    }

    const applied: AppliedStep[] = [];
    try {
      for (const line of prepared) {
        const current = working.get(line.item.itemId)!;
        const updated = await updateStockMovement(current, movementType, line.quantity);
        working.set(line.item.itemId, updated);
        applied.push({ updated, quantity: line.quantity });
      }
    } catch (error) {
      console.error("POST /api/stock sheet update failed", error);
      const reverted = await revertApplied(applied, movementType);
      if (!reverted) {
        return sheetUpdatedResponse(applied.map((step) => step.updated.itemName));
      }
      return rolledBackResponse();
    }

    const timestamp = new Date().toISOString();
    const notes = body.notes?.trim() ?? "";
    const userEmail = email ?? uid;
    const transactions: Transaction[] = prepared.map((line, index) => ({
      timestamp,
      itemId: applied[index].updated.itemId,
      itemName: applied[index].updated.itemName,
      type: movementType,
      quantity: line.quantity,
      userEmail,
      notes,
      destination: line.destination,
    }));

    try {
      await appendTransactions(transactions);
    } catch (error) {
      console.error("POST /api/stock log append failed", error);
      const reverted = await revertApplied(applied, movementType);
      if (!reverted) {
        return sheetUpdatedResponse(applied.map((step) => step.updated.itemName));
      }
      return rolledBackResponse();
    }

    const updatedItems = [...working.values()];
    let alertSent = false;
    for (const updatedItem of updatedItems) {
      try {
        await clearAlertIfRecovered(updatedItem);
        if (await sendLowStockAlert(updatedItem)) {
          alertSent = true;
        }
      } catch (error) {
        console.error("POST /api/stock alert failed", error);
      }
    }

    return NextResponse.json({
      items: updatedItems,
      item: updatedItems[updatedItems.length - 1],
      alertSent,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("POST /api/stock", error);
    return rolledBackResponse();
  }
}
