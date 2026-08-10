"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminDailyStockSection } from "@/components/admin/AdminDailyStockSection";
import { DestinationBreakdownChart } from "@/components/admin/DestinationBreakdownChart";
import { InOutMovementChart } from "@/components/admin/InOutMovementChart";
import { ItemUsageCompareChart } from "@/components/admin/ItemUsageCompareChart";
import { PeriodComparisonChart } from "@/components/admin/PeriodComparisonChart";
import { StockHealthCards } from "@/components/admin/StockHealthCards";
import { TopUsedDailyChart } from "@/components/admin/TopUsedDailyChart";
import { UserActivityChart } from "@/components/admin/UserActivityChart";
import { Button } from "@/components/ui/button";
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
import { todayDateKey } from "@/lib/dates";

const RANGE_OPTIONS = [
  { label: "Today", value: 0 },
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
] as const;

export function AnalyticsPageClient() {
  const [days, setDays] = useState(30);
  const [category, setCategory] = useState("");
  const [destination, setDestination] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => todayDateKey());
  const [compareItemIds, setCompareItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const lastCompareCategoryRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const headers = await getFirebaseAuthHeader();
        const analytics = await fetchAnalytics(days, headers, {
          category: category || undefined,
          destination,
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
          if (categoryChanged || prev.length === 0) {
            return categoryDefaults;
          }
          const kept = prev.filter((id) => validIds.has(id));
          return kept.length > 0 ? kept : categoryDefaults;
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
  }, [days, category, destination]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={days === option.value ? "default" : "outline"}
              onClick={() => setDays(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={category || undefined}
              onValueChange={setCategory}
              disabled={!data?.categories.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {(data?.categories ?? []).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {loading || !data ? (
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
              category={data.category}
              destination={data.destination}
            />
            <DestinationBreakdownChart
              totals={data.destinationTotals}
              category={data.category}
              destination={data.destination}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TopUsedDailyChart
              category={data.category}
              destination={data.destination}
              series={data.topConsumedDaily}
            />
            <PeriodComparisonChart
              series={data.periodComparison}
              category={data.category}
              destination={data.destination}
            />
          </div>

          <ItemUsageCompareChart
            options={data.inventoryOptions}
            selectedIds={compareItemIds}
            onSelectedIdsChange={setCompareItemIds}
            matrix={data.itemOuts}
            destination={data.destination}
            pageDays={days}
          />
        </>
      )}

      <AdminDailyStockSection
        date={selectedDate}
        onDateChange={setSelectedDate}
        destination={destination}
        category={category || undefined}
      />

      {!loading && data && <UserActivityChart data={data.userActivity} />}
    </div>
  );
}
