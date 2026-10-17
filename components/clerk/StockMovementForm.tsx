"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemSearchCombobox } from "@/components/clerk/ItemSearchCombobox";
import { fetchInventory, submitStockMovement } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import {
  CHOOSE_DESTINATION_MESSAGE,
  SELECT_ITEM_MESSAGE,
  STOCK_LOG_FAILED_SHEET_UPDATED,
  StockMovementError,
  insufficientStockMessage,
  isStockDestination,
  movementQuantityError,
} from "@/lib/stock";
import {
  STOCK_DESTINATIONS,
  type InventoryItem,
  type StockDestination,
} from "@/lib/types";

interface StockMovementFormProps {
  type: "in" | "out";
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

export function StockMovementForm({ type }: StockMovementFormProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [destination, setDestination] = useState<"" | StockDestination>("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchInventory()
      .then(setItems)
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Failed to load inventory")
      )
      .finally(() => setLoading(false));
  }, []);

  const selectedItem = items.find((item) => item.itemId === itemId);
  const quantityValue = Number(quantity);
  const quantityError = quantity.trim()
    ? movementQuantityError(quantityValue)
    : attempted
      ? movementQuantityError(quantityValue)
      : null;
  const stockError =
    type === "out" &&
    selectedItem &&
    !quantityError &&
    Number.isFinite(quantityValue) &&
    quantityValue > selectedItem.closingStock
      ? insufficientStockMessage(selectedItem, quantityValue)
      : null;
  const itemError = attempted && !selectedItem ? SELECT_ITEM_MESSAGE : undefined;
  const destinationError =
    type === "out" && !destination ? CHOOSE_DESTINATION_MESSAGE : undefined;
  const shownQuantityError = quantityError ?? stockError ?? undefined;
  const unitLabel = selectedItem?.unit.trim() || "units";
  const destinationReady = type === "in" || isStockDestination(destination);
  const canSubmit =
    !locked &&
    Boolean(selectedItem) &&
    !quantityError &&
    !stockError &&
    quantity.trim() !== "" &&
    destinationReady;

  const confirmation =
    selectedItem && canSubmit
      ? type === "in"
        ? `Add ${formatNumber(quantityValue)} ${unitLabel} of ${selectedItem.itemName}.`
        : `Remove ${formatNumber(quantityValue)} ${unitLabel} of ${selectedItem.itemName}, going to ${destination}.`
      : "";

  function reportError(message: string) {
    setFormError(message);
    toast.error(message);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (locked || submitting) return;
    setAttempted(true);
    setFormError("");

    if (!selectedItem) {
      reportError(SELECT_ITEM_MESSAGE);
      return;
    }
    const qtyError = movementQuantityError(quantityValue);
    if (qtyError) {
      reportError(qtyError);
      return;
    }
    if (type === "out" && stockError) {
      reportError(stockError);
      return;
    }
    if (type === "out" && !isStockDestination(destination)) {
      reportError(CHOOSE_DESTINATION_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitStockMovement({
        itemId,
        type,
        quantity: quantityValue,
        notes,
        ...(type === "out" && isStockDestination(destination)
          ? { destination }
          : {}),
      });
      const savedName = result.item?.itemName ?? selectedItem.itemName;
      toast.success(
        `${type === "in" ? "Stock in" : "Stock out"} recorded for ${savedName}.`
      );
      if (result.item) {
        setItems((current) =>
          current.map((item) =>
            item.itemId === result.item?.itemId ? result.item! : item
          )
        );
      }
      setQuantity("");
      setNotes("");
      setDestination("");
      setAttempted(false);
      setFormError("");
    } catch (error) {
      const movementError =
        error instanceof StockMovementError
          ? error
          : new StockMovementError(
              error instanceof Error ? error.message : "Update failed"
            );
      reportError(movementError.message);
      if (movementError.code === STOCK_LOG_FAILED_SHEET_UPDATED) {
        setLocked(true);
        try {
          setItems(await fetchInventory());
        } catch {
          // The warning already tells them not to enter this quantity again.
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{type === "in" ? "Record Stock In" : "Record Stock Out"}</CardTitle>
        <CardDescription>
          {type === "in"
            ? "Add received stock to the inventory."
            : "Choose where the stock is going before removing it from the store."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {formError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="space-y-2">
            <ItemSearchCombobox
              items={items}
              value={itemId}
              onChange={setItemId}
              disabled={loading || locked}
            />
            <FieldError id="item-error" message={itemError} />
          </div>

          {selectedItem && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              Available:{" "}
              <span className="font-semibold text-slate-900">
                {formatNumber(selectedItem.closingStock)} {unitLabel}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <div className="flex items-center gap-2">
              <Input
                id="quantity"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                aria-invalid={Boolean(shownQuantityError)}
                aria-describedby={shownQuantityError ? "quantity-error" : undefined}
                disabled={locked}
                required
              />
              {selectedItem?.unit ? (
                <span className="shrink-0 text-sm text-slate-600">{selectedItem.unit}</span>
              ) : null}
            </div>
            <FieldError id="quantity-error" message={shownQuantityError ?? undefined} />
          </div>

          {type === "out" && (
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <select
                id="destination"
                value={destination}
                onChange={(event) => {
                  const next = event.target.value;
                  setDestination(isStockDestination(next) ? next : "");
                }}
                aria-invalid={Boolean(destinationError)}
                aria-describedby={destinationError ? "destination-error" : undefined}
                disabled={locked}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <option value="">Select destination</option>
                {STOCK_DESTINATIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <FieldError id="destination-error" message={destinationError} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. breakfast service"
              disabled={locked}
            />
          </div>

          {confirmation ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              {confirmation}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit || submitting || loading}
          >
            {submitting ? "Saving..." : type === "in" ? "Add Stock" : "Remove Stock"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
