import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-auth";
import { getCorrections } from "@/lib/sheets";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? "100");
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), 500)
        : 100;

    const corrections = await getCorrections();
    // Newest first
    const sorted = [...corrections].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );

    return NextResponse.json({
      corrections: sorted.slice(0, limit),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("GET /api/stock/adjustments", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load corrections",
      },
      { status: 500 }
    );
  }
}
