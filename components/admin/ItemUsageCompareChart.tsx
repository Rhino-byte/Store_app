"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ItemMultiSelect } from "@/components/admin/ItemMultiSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InventoryOption, WeeklyItemOutMatrix } from "@/lib/analytics";
import { useIsMobile } from "@/lib/use-media-query";

const ITEM_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#ca8a04", "#7c3aed"];

interface ItemUsageCompareChartProps {
  options: InventoryOption[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  weekly: WeeklyItemOutMatrix | undefined;
  pageDays: number;
}

export function ItemUsageCompareChart({
  options,
  selectedIds,
  onSelectedIdsChange,
  weekly,
  pageDays,
}: ItemUsageCompareChartProps) {
  const isMobile = useIsMobile();

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of options) map.set(opt.itemId, opt.itemName);
    return map;
  }, [options]);

  const chartData = useMemo(() => {
    if (!weekly || selectedIds.length === 0) return [];
    return weekly.dates.map((date, index) => {
      const row: Record<string, string | number> = {
        date,
        label: weekly.labels[index] ?? date,
      };
      for (const itemId of selectedIds) {
        row[itemId] = weekly.byItemId[itemId]?.[index] ?? 0;
      }
      return row;
    });
  }, [weekly, selectedIds]);

  const rangeNote =
    pageDays === 0
      ? "Showing today only (matches the page range)."
      : pageDays === 7
        ? "Showing the last 7 days (matches the page range)."
        : "Showing the last 7 days for a readable weekly comparison.";

  return (
    <Card>
      <CardHeader className="space-y-3 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Compare item usage</CardTitle>
          <p className="mt-1 text-sm font-normal text-slate-500">
            Select up to 5 items to compare daily stock-out. {rangeNote}
          </p>
        </div>
        <ItemMultiSelect
          options={options}
          value={selectedIds}
          onChange={onSelectedIdsChange}
          max={5}
        />
      </CardHeader>
      <CardContent className="h-72 sm:h-96">
        {selectedIds.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            Select 2–5 items to compare their usage across the week.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: isMobile ? 10 : 12 }}
              />
              <YAxis width={isMobile ? 28 : 40} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {selectedIds.map((itemId, index) => (
                <Bar
                  key={itemId}
                  dataKey={itemId}
                  name={nameById.get(itemId) ?? itemId}
                  fill={ITEM_COLORS[index % ITEM_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
