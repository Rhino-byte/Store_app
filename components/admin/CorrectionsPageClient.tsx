"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ItemSearchCombobox } from "@/components/clerk/ItemSearchCombobox";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createStockAdjustment,
  fetchInventory,
  fetchStockAdjustments,
} from "@/lib/api-client";
import { getFirebaseAuthHeader } from "@/lib/auth/use-firebase-auth";
import { formatNumber } from "@/lib/utils";
import type { InventoryItem } from "@/lib/types";

type CorrectionRow = {
  timestamp: string;
  itemId: string;
  itemName: string;
  type: "in" | "out";
  quantity: number;
  userEmail: string;
  reason: string;
};

export function CorrectionsPageClient() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [itemId, setItemId] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const selectedItem = items.find((item) => item.itemId === itemId);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [inventory, rows] = await Promise.all([
        fetchInventory(),
        fetchStockAdjustments(100),
      ]);
      setItems(inventory);
      setCorrections(rows);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load corrections"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!itemId) {
      toast.error("Select an item.");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required.");
      return;
    }

    setSubmitting(true);
    try {
      const headers = await getFirebaseAuthHeader();
      const result = await createStockAdjustment(
        {
          itemId,
          direction,
          quantity: qty,
          reason: reason.trim(),
        },
        headers
      );
      toast.success(
        `${direction === "in" ? "Increased" : "Decreased"} ${result.item.itemName} by ${formatNumber(qty)}. New closing: ${formatNumber(result.item.closingStock)}.`
      );
      setItems((current) =>
        current.map((item) =>
          item.itemId === result.item.itemId ? result.item : item
        )
      );
      setCorrections((current) => [result.correction, ...current]);
      setQuantity("");
      setReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Adjustment failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <LoadingState
        label="Loading corrections"
        layout="centered"
        className="min-h-[40vh]"
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Record correction</CardTitle>
          <CardDescription>
            Updates live Sheet1 stock and logs a row on the Corrections sheet.
            Opening stock stays fixed — use this for quantity fixes.{" "}
            <Link href="/admin/items" className="text-emerald-700 underline">
              View items
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <ItemSearchCombobox
              items={items}
              value={itemId}
              onChange={setItemId}
            />

            {selectedItem && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Closing:{" "}
                <span className="font-semibold text-slate-900">
                  {formatNumber(selectedItem.closingStock)}{" "}
                  {selectedItem.unit || "units"}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="correction-direction">Direction</Label>
              <select
                id="correction-direction"
                value={direction}
                onChange={(event) =>
                  setDirection(event.target.value as "in" | "out")
                }
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <option value="in">Increase stock (correction in)</option>
                <option value="out">Decrease stock (correction out)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-qty">Quantity</Label>
              <Input
                id="correction-qty"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-reason">Reason</Label>
              <Input
                id="correction-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. count variance after physical stocktake"
                required
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? "Saving..." : "Save correction"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Recent corrections
          </h2>
          <p className="text-sm text-slate-500">
            From the Corrections sheet — who changed what and why.
          </p>
        </div>

        {corrections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No corrections recorded yet.
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.map((row) => (
                    <TableRow key={`${row.timestamp}-${row.itemId}-${row.reason}`}>
                      <TableCell className="whitespace-nowrap text-xs text-slate-600">
                        {row.timestamp
                          ? new Date(row.timestamp).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.itemName}
                      </TableCell>
                      <TableCell>
                        {row.type === "in" ? "In" : "Out"}
                      </TableCell>
                      <TableCell>{formatNumber(row.quantity)}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {row.userEmail || "—"}
                      </TableCell>
                      <TableCell>{row.reason || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {corrections.map((row) => (
                <Card key={`${row.timestamp}-${row.itemId}-${row.reason}-m`}>
                  <CardContent className="space-y-2 p-4 text-sm">
                    <p className="font-medium text-slate-900">{row.itemName}</p>
                    <p className="text-xs text-slate-500">
                      {row.timestamp
                        ? new Date(row.timestamp).toLocaleString()
                        : "—"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-slate-500">Type</p>
                        <p className="font-medium">
                          {row.type === "in" ? "In" : "Out"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Qty</p>
                        <p className="font-medium">
                          {formatNumber(row.quantity)}
                        </p>
                      </div>
                    </div>
                    <p className="text-slate-600">{row.reason}</p>
                    <p className="text-xs text-slate-500">{row.userEmail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
