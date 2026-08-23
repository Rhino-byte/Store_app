"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createItem, fetchInventory } from "@/lib/api-client";
import { getFirebaseAuthHeader } from "@/lib/auth/use-firebase-auth";
import { calculateClosingStock, previewNextItemId } from "@/lib/stock";
import type { InventoryItem } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface AddItemDialogProps {
  onCreated?: (item: InventoryItem) => void;
}

const emptyForm = {
  itemName: "",
  category: "",
  unit: "",
  openingStock: "0",
  stockIn: "0",
  stockOut: "0",
  reorderLevel: "",
  notes: "",
  price: "",
};

export function AddItemDialog({ onCreated }: AddItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingId, setLoadingId] = useState(false);
  const [nextItemId, setNextItemId] = useState<string>("…");
  const [form, setForm] = useState(emptyForm);

  const closingStock = useMemo(() => {
    const opening = Number(form.openingStock) || 0;
    const stockIn = Number(form.stockIn) || 0;
    const stockOut = Number(form.stockOut) || 0;
    return calculateClosingStock(opening, stockIn, stockOut);
  }, [form.openingStock, form.stockIn, form.stockOut]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function loadNextId() {
      setLoadingId(true);
      try {
        const items = await fetchInventory();
        if (!cancelled) {
          setNextItemId(previewNextItemId(items));
        }
      } catch {
        if (!cancelled) {
          setNextItemId("Auto");
        }
      } finally {
        if (!cancelled) {
          setLoadingId(false);
        }
      }
    }

    void loadNextId();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetAndClose() {
    setForm(emptyForm);
    setNextItemId("…");
    setOpen(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.itemName.trim()) {
      toast.error("Item Name is required.");
      return;
    }

    setSaving(true);
    try {
      const headers = await getFirebaseAuthHeader();
      const item = await createItem(
        {
          itemName: form.itemName.trim(),
          category: form.category.trim(),
          unit: form.unit.trim(),
          openingStock: Number(form.openingStock) || 0,
          stockIn: Number(form.stockIn) || 0,
          stockOut: Number(form.stockOut) || 0,
          reorderLevel:
            form.reorderLevel.trim() === ""
              ? null
              : Number(form.reorderLevel),
          notes: form.notes.trim(),
          price: form.price.trim() === "" ? null : Number(form.price),
        },
        headers
      );
      toast.success(`${item.itemName} added as ${item.itemId}.`);
      resetAndClose();
      onCreated?.(item);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setForm(emptyForm);
          setNextItemId("…");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add item
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-900">
                Add new item
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                Item ID is assigned automatically from the last item + 1.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Item ID</Label>
                <p className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                  {loadingId ? "…" : nextItemId}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-item-name">Item Name</Label>
                <Input
                  id="new-item-name"
                  value={form.itemName}
                  onChange={(event) => updateField("itemName", event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-item-category">Category</Label>
                <Input
                  id="new-item-category"
                  value={form.category}
                  onChange={(event) => updateField("category", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-item-unit">Unit</Label>
                <Input
                  id="new-item-unit"
                  value={form.unit}
                  onChange={(event) => updateField("unit", event.target.value)}
                  placeholder="e.g. kg, pcs, L"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-item-opening">Opening Stock</Label>
                <Input
                  id="new-item-opening"
                  type="number"
                  min={0}
                  step="any"
                  value={form.openingStock}
                  onChange={(event) =>
                    updateField("openingStock", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-item-in">Stock In</Label>
                <Input
                  id="new-item-in"
                  type="number"
                  min={0}
                  step="any"
                  value={form.stockIn}
                  onChange={(event) => updateField("stockIn", event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-item-out">Stock Out</Label>
                <Input
                  id="new-item-out"
                  type="number"
                  min={0}
                  step="any"
                  value={form.stockOut}
                  onChange={(event) => updateField("stockOut", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Closing Stock</Label>
                <p className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                  {formatNumber(closingStock)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-item-reorder">Reorder Level</Label>
                <Input
                  id="new-item-reorder"
                  type="number"
                  min={0}
                  step="any"
                  value={form.reorderLevel}
                  onChange={(event) =>
                    updateField("reorderLevel", event.target.value)
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-item-price">Price</Label>
                <Input
                  id="new-item-price"
                  type="number"
                  min={0}
                  step="any"
                  value={form.price}
                  onChange={(event) => updateField("price", event.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-item-notes">Notes</Label>
              <Input
                id="new-item-notes"
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={resetAndClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save item"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
