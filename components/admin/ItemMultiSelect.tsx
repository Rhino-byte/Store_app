"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InventoryOption } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const MAX_SELECTED = 5;

interface ItemMultiSelectProps {
  options: InventoryOption[];
  value: string[];
  onChange: (itemIds: string[]) => void;
  max?: number;
}

export function ItemMultiSelect({
  options,
  value,
  onChange,
  max = MAX_SELECTED,
}: ItemMultiSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter(
      (opt) =>
        opt.itemName.toLowerCase().includes(normalized) ||
        opt.category.toLowerCase().includes(normalized)
    );
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function toggle(itemId: string) {
    if (selectedSet.has(itemId)) {
      onChange(value.filter((id) => id !== itemId));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, itemId]);
  }

  const label =
    value.length === 0
      ? "Select items to compare"
      : `${value.length} item${value.length === 1 ? "" : "s"} selected`;

  return (
    <div ref={containerRef} className="relative w-full sm:w-72">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white p-2 shadow-md">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="mb-2"
            autoFocus
          />
          <p className="mb-1 px-1 text-xs text-slate-500">
            Select up to {max} items
          </p>
          <ul className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-sm text-slate-500">No items found</li>
            ) : (
              filtered.map((opt) => {
                const checked = selectedSet.has(opt.itemId);
                const disabled = !checked && value.length >= max;
                return (
                  <li key={opt.itemId}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(opt.itemId)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40",
                        checked && "bg-emerald-50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border border-slate-300",
                          checked && "border-emerald-700 bg-emerald-700 text-white"
                        )}
                      >
                        {checked ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {opt.itemName}
                        <span className="block truncate text-xs text-slate-500">
                          {opt.category}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
