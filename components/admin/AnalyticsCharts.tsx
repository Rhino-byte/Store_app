"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/lib/use-media-query";

interface AnalyticsChartsProps {
  topConsumed: Array<{ itemId: string; itemName: string; quantity: number }>;
}

export function AnalyticsCharts({ topConsumed }: AnalyticsChartsProps) {
  const isMobile = useIsMobile();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top consumed items</CardTitle>
        <p className="text-sm font-normal text-slate-500">
          Highest total stock-out across all categories in the selected range.
        </p>
      </CardHeader>
      <CardContent className="h-64 sm:h-80">
        {!topConsumed.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No consumption in this period.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topConsumed} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="itemName"
                width={isMobile ? 72 : 120}
                tick={{ fontSize: isMobile ? 11 : 12 }}
              />
              <Tooltip />
              <Bar dataKey="quantity" fill="#b45309" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
