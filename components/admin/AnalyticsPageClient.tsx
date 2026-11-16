"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DestinationBreakdownChart } from "@/components/admin/DestinationBreakdownChart";
import { InOutMovementChart } from "@/components/admin/InOutMovementChart";
import { ItemUsageCompareChart } from "@/components/admin/ItemUsageCompareChart";
import { StockHealthCards } from "@/components/admin/StockHealthCards";
import { UserActivityChart } from "@/components/admin/UserActivityChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AnalyticsPayload } from "@/lib/api-client";
import { fetchAnalytics } from "@/lib/api-client";
import { getFirebaseAuthHeader } from "@/lib/auth/use-firebase-auth";
import { resolveReportRange } from "@/lib/reports";

const RANGE_OPTIONS = [
  { label: "Today", value: 0 },
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
] as const;

type RangePreset = (typeof RANGE_OPTIONS)[number]["value"] | "custom";

export function AnalyticsPageClient() {
  const [rangePreset, setRangePreset] = useState<RangePreset>(30);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [appliedCustom, setAppliedCustom] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [category, setCategory] = useState("");
  const [destination, setDestination] = useState("all");
  const [compareItemIds, setCompareItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const lastCompareCategoryRef = useRef<string>("");

  const categoryReady =
    Boolean(category) && Boolean(data?.categories.includes(category));

  useEffect(() => {
    if (rangePreset === "custom" && !appliedCustom) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const headers = await getFirebaseAuthHeader();
        const days = rangePreset === "custom" ? 1 : rangePreset;
        const analytics = await fetchAnalytics(days, headers, {
          category: category || undefined,
          destination,
          from: rangePreset === "custom" ? appliedCustom?.from : undefined,
          to: rangePreset === "custom" ? appliedCustom?.to : undefined,
        });
        if (cancelled) return;

        setData(analytics);
        setCategory((prev) => {
          if (prev && analytics.categories.includes(prev)) return prev;
          return analytics.category;
        });

        const validIds = new Set(
          analytics.inventoryOptions.map((option) => option.itemId)
        );
        const categoryDefaults = analytics.itemOuts.topItemIds.filter((id) =>
          validIds.has(id)
        );
        const categoryChanged =
          lastCompareCategoryRef.current !== analytics.category;
        lastCompareCategoryRef.current = analytics.category;

        setCompareItemIds((prev) => {
          if (categoryChanged) {
            return categoryDefaults;
          }
          return prev.filter((id) => validIds.has(id));
        });
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load analytics"
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
  }, [rangePreset, appliedCustom, category, destination]);

  function handlePreset(next: (typeof RANGE_OPTIONS)[number]["value"]) {
    setAppliedCustom(null);
    setRangePreset(next);
  }

  function handleApplyCustom() {
    const resolved = resolveReportRange({
      period: "custom",
      from: customFrom,
      to: customTo,
    });
    if ("error" in resolved) {
      toast.error(resolved.error);
      return;
    }
    setAppliedCustom(resolved);
    setRangePreset("custom");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={rangePreset === option.value ? "default" : "outline"}
              onClick={() => handlePreset(option.value)}
            >
              {option.label}
            </Button>
          ))}
          <Button
            type="button"
            variant={rangePreset === "custom" ? "default" : "outline"}
            onClick={() => setRangePreset("custom")}
          >
            Custom
          </Button>
          {rangePreset === "custom" ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="analytics-from" className="text-xs">
                  From
                </Label>
                <Input
                  id="analytics-from"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="analytics-to" className="text-xs">
                  To
                </Label>
                <Input
                  id="analytics-to"
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="w-40"
                />
              </div>
              <Button type="button" onClick={handleApplyCustom}>
                Apply
              </Button>
            </>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          <div className="space-y-2">
            <Label>Category</Label>
            {categoryReady ? (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {data?.categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <button
                type="button"
                disabled
                className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select category
              </button>
            )}
          </div>
          <div className="space-y-2">
            <Label>Destination</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger>
                <SelectValue placeholder="Destination" />
              </SelectTrigger>
              <SelectContent>
                {(data?.destinations ?? ["all"]).map((dest) => (
                  <SelectItem key={dest} value={dest}>
                    {dest === "all" ? "All destinations" : dest}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {rangePreset === "custom" && !appliedCustom && !data ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          Choose a from and to date, then click Apply.
        </p>
      ) : loading || !data ? (
        <LoadingState
          label="Loading analytics"
          layout="centered"
          className="min-h-[40vh]"
        />
      ) : (
        <>
          <StockHealthCards health={data.stockHealth} />

          <div className="grid gap-6 lg:grid-cols-2">
            <InOutMovementChart
              points={data.dailyMovement}
              receipts={data.stockInReceipts ?? []}
              category={data.category}
              destination={data.destination}
            />
            <DestinationBreakdownChart
              totals={data.destinationTotals}
              issues={data.destinationIssues ?? []}
              category={data.category}
            />
          </div>

          <ItemUsageCompareChart
            options={data.inventoryOptions}
            selectedIds={compareItemIds}
            onSelectedIdsChange={setCompareItemIds}
            matrix={data.itemOuts}
            destination={data.destination}
            category={data.category}
            rangeFrom={data.from}
            rangeTo={data.to}
          />
        </>
      )}

      {!loading && data && <UserActivityChart data={data.userActivity} />}
    </div>
  );
}
