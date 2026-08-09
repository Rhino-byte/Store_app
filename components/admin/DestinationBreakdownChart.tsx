"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DestinationTotal } from "@/lib/analytics";
import { formatNumber } from "@/lib/utils";

const PIE_COLORS = ["#047857", "#b45309", "#1d4ed8", "#7c3aed", "#be123c"];

interface DestinationBreakdownChartProps {
  totals: DestinationTotal[];
  category: string;
  destination: string;
}

export function DestinationBreakdownChart({
  totals,
  category,
  destination,
}: DestinationBreakdownChartProps) {
  if (destination !== "all") {
    const match = totals.find((row) => row.destination === destination);
    const quantity = match?.quantity ?? 0;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Destination total</CardTitle>
          <p className="text-sm font-normal text-slate-500">
            Stock out to {destination} in {category}.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-slate-900">
            {formatNumber(quantity)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Total quantity issued to {destination}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock out by destination</CardTitle>
        <p className="text-sm font-normal text-slate-500">
          Where {category} items went in this range.
        </p>
      </CardHeader>
      <CardContent className="h-72 sm:h-80">
        {!totals.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No stock-out destinations in this range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={totals}
                dataKey="quantity"
                nameKey="destination"
                cx="50%"
                cy="50%"
                outerRadius={90}
              >
                {totals.map((entry, index) => (
                  <Cell
                    key={entry.destination}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  formatNumber(typeof value === "number" ? value : Number(value))
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
