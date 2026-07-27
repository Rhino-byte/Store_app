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
import type { PeriodComparisonSeries } from "@/lib/analytics";
import { useIsMobile } from "@/lib/use-media-query";

interface PeriodComparisonChartProps {
  series: PeriodComparisonSeries | undefined;
  category: string;
}

function ComparisonTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const current =
    payload.find((p) => p.dataKey === "current")?.value ?? 0;
  const previous =
    payload.find((p) => p.dataKey === "previous")?.value ?? 0;
  let deltaLabel = "—";
  if (previous === 0) {
    deltaLabel = current > 0 ? "+100%" : "0%";
  } else {
    const pct = ((current - previous) / previous) * 100;
    deltaLabel = `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-slate-900">{label}</p>
      <p className="text-slate-600">Current: {current}</p>
      <p className="text-slate-600">Previous: {previous}</p>
      <p className="text-slate-800">Δ {deltaLabel}</p>
    </div>
  );
}

export function PeriodComparisonChart({
  series,
  category,
}: PeriodComparisonChartProps) {
  const isMobile = useIsMobile();
  const points = series?.points ?? [];
  const categoryNote =
    category !== "all" ? ` (${category})` : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumption vs previous period{categoryNote}</CardTitle>
        <p className="text-sm font-normal text-slate-500">
          Solid bars are this period; outlined bars are the matching days in the
          previous period of equal length.
        </p>
      </CardHeader>
      <CardContent className="h-72 sm:h-96">
        {!points.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No consumption data to compare for this range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                interval="preserveStartEnd"
              />
              <YAxis width={isMobile ? 28 : 40} allowDecimals={false} />
              <Tooltip content={<ComparisonTooltip />} />
              <Legend />
              <Bar
                dataKey="current"
                name="This period"
                fill="#047857"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="previous"
                name="Previous period"
                fill="#04785733"
                stroke="#047857"
                strokeWidth={1.5}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
