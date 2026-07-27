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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DailyItemSeries } from "@/lib/analytics";
import { useIsMobile } from "@/lib/use-media-query";

const ITEM_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#ca8a04", "#7c3aed"];

interface TopUsedDailyChartProps {
  categories: string[];
  category: string;
  onCategoryChange: (category: string) => void;
  series: DailyItemSeries | undefined;
}

export function TopUsedDailyChart({
  categories,
  category,
  onCategoryChange,
  series,
}: TopUsedDailyChartProps) {
  const isMobile = useIsMobile();
  const items = series?.items ?? [];
  const points = series?.points ?? [];
  const xKey = points.some((p) => "label" in p) ? "label" : "date";

  return (
    <Card>
      <CardHeader className="space-y-3 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Top 5 most used items</CardTitle>
          <p className="mt-1 text-sm font-normal text-slate-500">
            Daily usage for the five highest-consumption items
            {category !== "all" ? ` in ${category}` : ""}.
          </p>
        </div>
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="h-64 sm:h-80">
        {!items.length || !points.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No consumption in this category for the selected range.
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
