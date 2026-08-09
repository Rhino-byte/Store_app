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
import type { InventoryOption, ItemOutMatrix } from "@/lib/analytics";
import { useIsMobile } from "@/lib/use-media-query";

const ITEM_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#ca8a04", "#7c3aed"];

interface ItemUsageCompareChartProps {
  options: InventoryOption[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  matrix: ItemOutMatrix | undefined;
  category: string;
  destination: string;
  pageDays: number;
}

export function ItemUsageCompareChart({
  options,
  selectedIds,
  onSelectedIdsChange,
  matrix,
  category,
  destination,
  pageDays,
}: ItemUsageCompareChartProps) {
  const isMobile = useIsMobile();

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of options) map.set(opt.itemId, opt.itemName);
    return map;
  }, [options]);

  const chartData = useMemo(() => {
    if (!matrix || selectedIds.length === 0) return [];
    return matrix.dates.map((date, index) => {
      const row: Record<string, string | number> = {
        date,
        label: matrix.labels[index] ?? date,
      };
      for (const itemId of selectedIds) {
        row[itemId] = matrix.byItemId[itemId]?.[index] ?? 0;
      }
      return row;
    });
  }, [matrix, selectedIds]);

  const spanDays =
    pageDays === 0 ? 1 : pageDays === 7 ? 7 : Math.min(pageDays, 30);
  const destNote =
    destination !== "all" ? ` Destination: ${destination}.` : "";

  return (
    <Card>
      <CardHeader className="space-y-3 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Compare item usage</CardTitle>
          <p className="mt-1 text-sm font-normal text-slate-500">
            Daily stock-out in {category} over the last {spanDays} day
            {spanDays === 1 ? "" : "s"}.{destNote}
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
            Select items to compare their usage.
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
