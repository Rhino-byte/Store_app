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
import type { DailyInOutPoint } from "@/lib/analytics";
import { useIsMobile } from "@/lib/use-media-query";

interface InOutMovementChartProps {
  points: DailyInOutPoint[];
  category: string;
  destination: string;
}

export function InOutMovementChart({
  points,
  category,
  destination,
}: InOutMovementChartProps) {
  const isMobile = useIsMobile();
  const destNote =
    destination !== "all"
      ? ` Out series limited to ${destination}.`
      : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily stock in vs out</CardTitle>
        <p className="text-sm font-normal text-slate-500">
          Received vs used in {category}.{destNote} Units may vary within the
          category.
        </p>
      </CardHeader>
      <CardContent className="h-72 sm:h-96">
        {!points.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No movements in this range.
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
              <Tooltip />
              <Legend />
              <Bar
                dataKey="in"
                name="Stock in"
                fill="#047857"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="out"
                name="Stock out"
                fill="#b45309"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
