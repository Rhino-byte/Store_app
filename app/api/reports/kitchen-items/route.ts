import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-auth";
import {
  getInventoryItems,
  getKitchenReportItems,
  saveKitchenReportItems,
} from "@/lib/sheets";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const [inventory, selected] = await Promise.all([
      getInventoryItems(),
      getKitchenReportItems(),
    ]);
    const byId = new Map(inventory.map((item) => [item.itemId, item]));

    return NextResponse.json({
      items: selected.map((ref) => {
        const item = byId.get(ref.itemId);
        return {
          itemId: ref.itemId,
          itemName: item?.itemName || ref.itemName || ref.itemId,
          unit: item?.unit ?? "",
          matched: Boolean(item),
        };
      }),
      options: inventory.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        unit: item.unit,
        category: item.category,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("GET /api/reports/kitchen-items", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load kitchen report items",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as { itemIds?: unknown };

    if (!Array.isArray(body.itemIds)) {
      return NextResponse.json(
        { error: "itemIds must be an array." },
        { status: 400 }
      );
    }

    const itemIds = body.itemIds.map((id) => String(id ?? ""));
    const saved = await saveKitchenReportItems(itemIds);

    return NextResponse.json({ items: saved });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("PUT /api/reports/kitchen-items", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save kitchen report items",
      },
      { status: 500 }
    );
  }
}
