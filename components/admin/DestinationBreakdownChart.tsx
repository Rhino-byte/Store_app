"use client";

import { DestinationPieChart } from "@/components/admin/DestinationPieChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DestinationIssue, DestinationTotal } from "@/lib/analytics";

interface DestinationBreakdownChartProps {
  totals: DestinationTotal[];
  issues: DestinationIssue[];
  category: string;
}

export function DestinationBreakdownChart({
  totals,
  issues,
  category,
}: DestinationBreakdownChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock out by destination</CardTitle>
        <p className="text-sm font-normal text-slate-500">
          Where {category} items went in this range.
        </p>
      </CardHeader>
      <CardContent>
        <DestinationPieChart
          totals={totals}
          issues={issues}
          emptyMessage="No stock-out destinations in this range."
        />
      </CardContent>
    </Card>
  );
}
