"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ItemMultiSelect } from "@/components/admin/ItemMultiSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InventoryOption, ItemOutMatrix } from "@/lib/analytics";
import { useIsMobile } from "@/lib/use-media-query";

const ITEM_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#ca8a04",
  "#7c3aed",
  "#db2777",
  "#0f766e",
  "#b45309",
  "#1d4ed8",
  "#be123c",
];

interface ItemUsageCompareChartProps {
  options: InventoryOption[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  matrix: ItemOutMatrix | undefined;
  destination: string;
  category: string;
  rangeFrom?: string;
  rangeTo?: string;
}

function yAxisMax(dataMax: number): number {
  if (!Number.isFinite(dataMax) || dataMax <= 0) return 1;
  return Math.ceil(dataMax);
}

export function ItemUsageCompareChart({
  options,
  selectedIds,
  onSelectedIdsChange,
  matrix,
  destination,
  category,
  rangeFrom,
  rangeTo,
}: ItemUsageCompareChartProps) {
  const isMobile = useIsMobile();

  const categoryOptions = useMemo(
    () => options.filter((opt) => opt.category === category),
    [options, category]
  );

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of categoryOptions) map.set(opt.itemId, opt.itemName);
    return map;
  }, [categoryOptions]);

  const visibleIds = useMemo(
    () => selectedIds.filter((id) => nameById.has(id)),
    [selectedIds, nameById]
  );

  const chartData = useMemo(() => {
    if (!matrix || visibleIds.length === 0) return [];
    return matrix.dates.map((date, index) => {
      const row: Record<string, string | number> = {
        date,
        label: matrix.labels[index] ?? date,
      };
      for (const itemId of visibleIds) {
        row[itemId] = matrix.byItemId[itemId]?.[index] ?? 0;
      }
      return row;
    });
  }, [matrix, visibleIds]);

  const rangeLabel =
    rangeFrom && rangeTo
      ? rangeFrom === rangeTo
        ? rangeFrom
        : `${rangeFrom} to ${rangeTo}`
      : matrix?.from && matrix?.to
        ? matrix.from === matrix.to
          ? matrix.from
          : `${matrix.from} to ${matrix.to}`
        : "";
  const destNote =
    destination !== "all" ? ` Destination: ${destination}.` : "";
  const showDots = chartData.length <= 14;

  return (
    <Card>
      <CardHeader className="space-y-3 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Compare item usage</CardTitle>
          <p className="mt-1 text-sm font-normal text-slate-500">
            Only items in {category}. Three are selected automatically; unselect
            any to hide them from the plot.
            {rangeLabel ? ` Showing ${rangeLabel}.` : ""}
            {destNote}
          </p>
        </div>
        <ItemMultiSelect
          options={categoryOptions}
          value={visibleIds}
          onChange={onSelectedIdsChange}
        />
      </CardHeader>
      <CardContent className="h-72 sm:h-96">
        {visibleIds.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            Select items in {category} to compare their usage.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                width={isMobile ? 28 : 40}
                allowDecimals={false}
                domain={[0, yAxisMax]}
              />
              <Tooltip />
              <Legend />
              {visibleIds.map((itemId, index) => (
                <Line
                  key={itemId}
                  type="monotone"
                  dataKey={itemId}
                  name={nameById.get(itemId) ?? itemId}
                  stroke={ITEM_COLORS[index % ITEM_COLORS.length]}
                  strokeWidth={2}
                  dot={showDots ? { r: 3 } : false}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
