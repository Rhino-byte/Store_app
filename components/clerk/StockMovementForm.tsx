"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ItemSearchCombobox } from "@/components/clerk/ItemSearchCombobox";
import { fetchInventory, submitStockMovement } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import {
  CHOOSE_DESTINATION_MESSAGE,
  EMPTY_STOCK_LIST_MESSAGE,
  SELECT_ITEM_MESSAGE,
  STOCK_LOG_FAILED_SHEET_UPDATED,
  StockMovementError,
  insufficientStockMessage,
  isStockDestination,
  mergeStockLine,
  movementQuantityError,
  queuedQuantityForItem,
  validatePendingLine,
} from "@/lib/stock";
import {
  STOCK_DESTINATIONS,
  type InventoryItem,
  type StockDestination,
  type StockMovementLine,
} from "@/lib/types";

interface StockMovementFormProps {
  type: "in" | "out";
}

interface PendingLine extends StockMovementLine {
  itemName: string;
  unit: string;
  destination?: StockDestination;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

function lineKey(line: { itemId: string; destination?: string }) {
  return `${line.itemId}:${line.destination ?? ""}`;
}

export function StockMovementForm({ type }: StockMovementFormProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [lines, setLines] = useState<PendingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [addAttempted, setAddAttempted] = useState(false);
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
  const queuedForSelected = selectedItem
    ? queuedQuantityForItem(lines, selectedItem.itemId)
    : 0;
  const itemError = addAttempted && !selectedItem ? SELECT_ITEM_MESSAGE : undefined;
  const quantityReadyToCheck = Boolean(selectedItem) && (quantity.trim() !== "" || addAttempted);
  const quantityError = quantityReadyToCheck
    ? movementQuantityError(quantityValue)
    : null;
  const stockError =
    type === "out" &&
    selectedItem &&
    quantityReadyToCheck &&
    !quantityError &&
    quantity.trim() !== "" &&
    Number.isFinite(quantityValue) &&
    queuedForSelected + quantityValue > selectedItem.closingStock
      ? insufficientStockMessage(selectedItem, queuedForSelected + quantityValue)
      : null;
  const shownQuantityError = itemError
    ? undefined
    : (quantityError ?? stockError ?? undefined);
  const destinationError =
    type === "out" &&
    addAttempted &&
    !itemError &&
    !shownQuantityError &&
    !isStockDestination(destination)
      ? CHOOSE_DESTINATION_MESSAGE
      : undefined;
  const unitLabel = selectedItem?.unit.trim() || "units";
  const canSave = !locked && lines.length > 0;

  function reportError(message: string) {
    setFormError(message);
    toast.error(message);
  }

  function addOnEnter(event: React.KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleAdd();
  }

  function handleAdd() {
    if (locked || submitting) return;
    setAddAttempted(true);
    setFormError("");

    const error = validatePendingLine({
      item: selectedItem,
      type,
      quantity: quantityValue,
      destination,
      alreadyQueued: queuedForSelected,
    });
    if (error || !selectedItem) return;

    const nextDestination =
      type === "out" && isStockDestination(destination) ? destination : undefined;
    setLines((current) =>
      mergeStockLine(current, {
        itemId: selectedItem.itemId,
        itemName: selectedItem.itemName,
        unit: selectedItem.unit,
        quantity: quantityValue,
        destination: nextDestination,
      })
    );
    setItemId("");
    setQuantity("");
    setDestination("");
    setAddAttempted(false);
    setFormError("");
  }

  function removeLine(line: PendingLine) {
    const key = lineKey(line);
    setLines((current) => current.filter((entry) => lineKey(entry) !== key));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (locked || submitting) return;
    setFormError("");

    if (lines.length === 0) {
      reportError(EMPTY_STOCK_LIST_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitStockMovement({
        type,
        notes,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          ...(line.destination ? { destination: line.destination } : {}),
        })),
      });
      const savedCount = lines.length;
      toast.success(
        `${type === "in" ? "Stock in" : "Stock out"} recorded for ${savedCount} ${
          savedCount === 1 ? "item" : "items"
        }.`
      );
      if (result.items?.length) {
        const updated = new Map(result.items.map((item) => [item.itemId, item]));
        setItems((current) =>
          current.map((item) => updated.get(item.itemId) ?? item)
        );
      }
      setLines([]);
      setQuantity("");
      setNotes("");
      setDestination("");
      setItemId("");
      setAddAttempted(false);
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
        setLines([]);
        try {
          setItems(await fetchInventory());
        } catch {
          // The warning already tells them not to enter these quantities again.
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
            ? "Add received items to the list, then save them together."
            : "Add each item and where it is going, then remove them from the store together."}
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
              {queuedForSelected > 0 ? (
                <span>
                  {" "}
                  ({formatNumber(queuedForSelected)} {unitLabel} already in this list)
                </span>
              ) : null}
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
                onKeyDown={addOnEnter}
                aria-invalid={Boolean(shownQuantityError)}
                aria-describedby={shownQuantityError ? "quantity-error" : undefined}
                disabled={locked}
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
                onKeyDown={addOnEnter}
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

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleAdd}
            disabled={locked || loading || submitting}
          >
            Add to list
          </Button>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              {type === "in" ? "Items to add" : "Items to remove"}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {type === "out" ? <TableHead>Destination</TableHead> : null}
                  <TableHead>Quantity</TableHead>
                  <TableHead className="w-24 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={type === "out" ? 4 : 3}
                      className="text-slate-500"
                    >
                      No items added yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line) => (
                    <TableRow key={lineKey(line)}>
                      <TableCell className="font-medium text-slate-900">
                        {line.itemName}
                      </TableCell>
                      {type === "out" ? (
                        <TableCell>{line.destination}</TableCell>
                      ) : null}
                      <TableCell>
                        {formatNumber(line.quantity)} {line.unit.trim() || "units"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line)}
                          disabled={locked || submitting}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

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

          <Button
            type="submit"
            className="w-full"
            disabled={!canSave || submitting || loading}
          >
            {submitting ? "Saving..." : type === "in" ? "Add Stock" : "Remove Stock"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
