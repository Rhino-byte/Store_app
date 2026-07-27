"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminDailyStockSection } from "@/components/admin/AdminDailyStockSection";
import { AnalyticsCharts } from "@/components/admin/AnalyticsCharts";
import { ItemUsageCompareChart } from "@/components/admin/ItemUsageCompareChart";
import { PeriodComparisonChart } from "@/components/admin/PeriodComparisonChart";
import { TopUsedDailyChart } from "@/components/admin/TopUsedDailyChart";
import { UserActivityChart } from "@/components/admin/UserActivityChart";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
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
  const [selectedDate, setSelectedDate] = useState(() => todayDateKey());
  const [category, setCategory] = useState("all");
  const [compareItemIds, setCompareItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const headers = await getFirebaseAuthHeader();
        const analytics = await fetchAnalytics(days, headers);
        setData(analytics);
        setCategory((prev) => {
          if (prev === "all") return prev;
          return analytics.categories.includes(prev) ? prev : "all";
        });
        setCompareItemIds((prev) => {
          const valid = new Set(
            analytics.inventoryOptions.map((o) => o.itemId)
          );
          return prev.filter((id) => valid.has(id));
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load analytics"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [days]);

  const topDaily =
    data?.topConsumedDailyByCategory?.[category] ??
    data?.topConsumedDailyByCategory?.all;
  const periodSeries =
    data?.periodComparisonByCategory?.[category] ??
    data?.periodComparisonByCategory?.all;

  return (
    <div className="space-y-6">
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

      {loading || !data ? (
        <LoadingState
          label="Loading analytics"
          layout="centered"
          className="min-h-[40vh]"
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <TopUsedDailyChart
              categories={data.categories}
              category={category}
              onCategoryChange={setCategory}
              series={topDaily}
            />
            <AnalyticsCharts topConsumed={data.topConsumed} />
          </div>

          <PeriodComparisonChart series={periodSeries} category={category} />

          <ItemUsageCompareChart
            options={data.inventoryOptions}
            selectedIds={compareItemIds}
            onSelectedIdsChange={setCompareItemIds}
            weekly={data.weeklyItemOuts}
            pageDays={days}
          />
        </>
      )}

      <AdminDailyStockSection
        date={selectedDate}
        onDateChange={setSelectedDate}
      />

      {!loading && data && <UserActivityChart data={data.userActivity} />}
    </div>
  );
}
