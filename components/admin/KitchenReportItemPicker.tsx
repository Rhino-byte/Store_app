"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchKitchenReportItems,
  saveKitchenReportItems,
  type KitchenReportPickerItem,
  type KitchenReportPickerOption,
} from "@/lib/api-client";

interface KitchenReportItemPickerProps {
  onSaved?: () => void;
}

export function KitchenReportItemPicker({
  onSaved,
}: KitchenReportItemPickerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<KitchenReportPickerOption[]>([]);
  const [selected, setSelected] = useState<KitchenReportPickerItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded || loaded) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchKitchenReportItems();
        if (cancelled) return;
        setOptions(data.options);
        setSelected(data.items);
        setSavedIds(data.items.map((item) => item.itemId));
        setLoaded(true);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to load kitchen PDF items"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [expanded, loaded]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedIds = useMemo(
    () => new Set(selected.map((item) => item.itemId)),
    [selected]
  );

  const available = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return options.filter((option) => {
      if (selectedIds.has(option.itemId)) return false;
      if (!normalized) return true;
      return (
        option.itemName.toLowerCase().includes(normalized) ||
        option.category.toLowerCase().includes(normalized)
      );
    });
  }, [options, query, selectedIds]);

  const dirty =
    selected.map((item) => item.itemId).join("\0") !== savedIds.join("\0");

  function addItem(option: KitchenReportPickerOption) {
    setSelected((current) => [
      ...current,
      {
        itemId: option.itemId,
        itemName: option.itemName,
        unit: option.unit,
        matched: true,
      },
    ]);
    setQuery("");
    setOpen(false);
  }

  function removeItem(itemId: string) {
    setSelected((current) => current.filter((item) => item.itemId !== itemId));
  }

  function moveItem(itemId: string, direction: -1 | 1) {
    setSelected((current) => {
      const index = current.findIndex((item) => item.itemId === itemId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(nextIndex, 0, row);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = await saveKitchenReportItems(
        selected.map((item) => item.itemId)
      );
      const byId = new Map(options.map((option) => [option.itemId, option]));
      const nextSelected = data.items.map((item) => {
        const option = byId.get(item.itemId);
        return {
          itemId: item.itemId,
          itemName: option?.itemName || item.itemName,
          unit: option?.unit ?? "",
          matched: Boolean(option),
        };
      });
      setSelected(nextSelected);
      setSavedIds(nextSelected.map((item) => item.itemId));
      toast.success("Kitchen daily PDF items saved.");
      onSaved?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save kitchen PDF items"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            {expanded ? "Hide PDF items" : "Edit PDF items"}
          </span>
          <span className="mt-0.5 block text-sm text-slate-500">
            {dirty
              ? "Unsaved changes"
              : "Choose which items appear on the daily kitchen PDF"}
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-200 p-4 pt-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading items…</p>
          ) : (
        <>
          <div ref={searchRef} className="relative">
            <Label htmlFor="kitchen-pdf-add">Add item</Label>
            <Input
              id="kitchen-pdf-add"
              className="mt-2 bg-white"
              placeholder="Search inventory to add"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
            {open && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md">
                {available.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">
                    {query.trim()
                      ? "No matching items."
                      : "All inventory items are already on the report."}
                  </p>
                ) : (
                  available.slice(0, 20).map((option) => (
                    <button
                      key={option.itemId}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => addItem(option)}
                    >
                      <span className="min-w-0 truncate">
                        {option.itemName}
                        {option.unit ? (
                          <span className="text-slate-500"> ({option.unit})</span>
                        ) : null}
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selected.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
              No items on the kitchen daily PDF yet. Add items above.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
              {selected.map((item, index) => (
                <li
                  key={item.itemId}
                  className="flex items-center gap-2 px-2 py-1.5 sm:px-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                    {item.itemName}
                    {item.unit ? (
                      <span className="font-normal text-slate-500">
                        {" "}
                        ({item.unit})
                      </span>
                    ) : null}
                    {!item.matched ? (
                      <span className="ml-2 font-normal text-amber-700">
                        Not in inventory
                      </span>
                    ) : null}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={index === 0}
                      onClick={() => moveItem(item.itemId, -1)}
                      aria-label={`Move ${item.itemName} up`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={index === selected.length - 1}
                      onClick={() => moveItem(item.itemId, 1)}
                      aria-label={`Move ${item.itemName} down`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-500 hover:text-red-700"
                      onClick={() => removeItem(item.itemId)}
                      aria-label={`Remove ${item.itemName}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !dirty}
            >
              {saving ? "Saving..." : "Save PDF items"}
            </Button>
          </div>
        </>
          )}
        </div>
      ) : null}
    </div>
  );
}
