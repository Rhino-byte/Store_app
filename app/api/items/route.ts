import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-auth";
import { createInventoryItem, updateItemMetadata } from "@/lib/sheets";
import type { ItemCreateRequest, ItemUpdateRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as ItemCreateRequest;

    if (!body.itemName?.trim()) {
      return NextResponse.json(
        { error: "Item Name is required." },
        { status: 400 }
      );
    }

    const item = await createInventoryItem(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("POST /api/items", error);
    const message =
      error instanceof Error ? error.message : "Failed to create item";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as ItemUpdateRequest;

    if (!body.itemId) {
      return NextResponse.json({ error: "itemId is required." }, { status: 400 });
    }

    const item = await updateItemMetadata(body);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("PUT /api/items", error);
    const message =
      error instanceof Error ? error.message : "Failed to update item";
    const status = message.includes("Opening stock cannot be changed")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
