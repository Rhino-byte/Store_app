"use client";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyItemSeries } from "@/lib/analytics";
import { useIsMobile } from "@/lib/use-media-query";

const ITEM_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#ca8a04", "#7c3aed"];

interface TopUsedDailyChartProps {
  category: string;
  destination: string;
  series: DailyItemSeries | undefined;
}

export function TopUsedDailyChart({
  category,
  destination,
  series,
}: TopUsedDailyChartProps) {
  const isMobile = useIsMobile();
  const items = series?.items ?? [];
  const points = series?.points ?? [];
  const xKey = points.some((p) => "label" in p) ? "label" : "date";
  const destNote =
    destination !== "all" ? ` to ${destination}` : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 most used items</CardTitle>
        <p className="mt-1 text-sm font-normal text-slate-500">
          Daily stock-out for the five highest-consumption items in {category}
          {destNote}.
        </p>
      </CardHeader>
      <CardContent className="h-64 sm:h-80">
        {!items.length || !points.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No consumption in this category for the selected filters.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: isMobile ? 10 : 12 }}
                interval="preserveStartEnd"
              />
              <YAxis width={isMobile ? 28 : 40} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {items.map((item, index) => (
                <Bar
                  key={item.itemId}
                  dataKey={item.itemId}
                  name={item.itemName}
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
