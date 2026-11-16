"use client";

import { useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type PieLabelRenderProps,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DestinationIssue, DestinationTotal } from "@/lib/analytics";
import { formatNumber } from "@/lib/utils";

const PIE_COLORS = [
  "#047857",
  "#b45309",
  "#1d4ed8",
  "#7c3aed",
  "#be123c",
  "#0f766e",
  "#a16207",
  "#4338ca",
];

interface DestinationPieChartProps {
  totals: DestinationTotal[];
  issues: DestinationIssue[];
  emptyMessage?: string;
}

function slicePercent(quantity: number, total: number): number {
  if (total <= 0) return 0;
  return (quantity / total) * 100;
}

function formatPercent(quantity: number, total: number): string {
  const pct = slicePercent(quantity, total);
  if (pct > 0 && pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}

function dateRangeForDestination(
  issues: DestinationIssue[],
  destination: string
): { first: string; last: string } | null {
  const dates = issues
    .filter((row) => row.destination === destination)
    .map((row) => row.date)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return null;
  return { first: dates[0], last: dates[dates.length - 1] };
}

function sliceLabel(props: PieLabelRenderProps) {
  const percent = typeof props.percent === "number" ? props.percent : 0;
  if (percent < 0.04) return null;
  const name = typeof props.name === "string" ? props.name : "";
  return `${name} ${Math.round(percent * 100)}%`;
}

export function DestinationPieChart({
  totals,
  issues,
  emptyMessage = "No stock-out destinations in this range.",
}: DestinationPieChartProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const grandTotal = useMemo(
    () => totals.reduce((sum, row) => sum + row.quantity, 0),
    [totals]
  );

  const selectedIssues = useMemo(() => {
    if (!selected) return [];
    return issues.filter((row) => row.destination === selected);
  }, [issues, selected]);

  const selectedTotal = useMemo(
    () => selectedIssues.reduce((sum, row) => sum + row.quantity, 0),
    [selectedIssues]
  );

  function toggleDestination(destination: string) {
    setSelected((current) => (current === destination ? null : destination));
  }

  if (!totals.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Click a destination to see which items went there and when.
      </p>
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={totals}
              dataKey="quantity"
              nameKey="destination"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={sliceLabel}
              labelLine
              onClick={(entry) => {
                const payload = entry as unknown as DestinationTotal & {
                  payload?: DestinationTotal;
                };
                const dest =
                  payload.destination ?? payload.payload?.destination ?? "";
                if (dest) toggleDestination(dest);
              }}
            >
              {totals.map((entry, index) => (
                <Cell
                  key={entry.destination}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                  opacity={
                    !selected || selected === entry.destination ? 1 : 0.35
                  }
                  cursor="pointer"
                  stroke={
                    selected === entry.destination ? "#0f172a" : "transparent"
                  }
                  strokeWidth={selected === entry.destination ? 2 : 0}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => {
                const quantity =
                  typeof value === "number" ? value : Number(value);
                const payload = item?.payload as DestinationTotal | undefined;
                const dest = payload?.destination ?? "";
                const range = dest
                  ? dateRangeForDestination(issues, dest)
                  : null;
                const dateText = range
                  ? range.first === range.last
                    ? range.first
                    : `${range.first} – ${range.last}`
                  : "dates unavailable";
                return [
                  `${formatNumber(quantity)} (${formatPercent(quantity, grandTotal)}) · ${dateText}`,
                  dest || "Destination",
                ];
              }}
            />
            <Legend
              onClick={(payload) => {
                const dest =
                  typeof payload.value === "string" ? payload.value : "";
                if (dest) toggleDestination(dest);
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {selected ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Items issued to {selected}
              </h3>
              <p className="text-xs text-slate-500">
                {formatNumber(selectedTotal)} total (
                {formatPercent(selectedTotal, grandTotal)} of stock-out)
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelected(null)}
            >
              Show all destinations
            </Button>
          </div>
          {selectedIssues.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No item-level stock-out for this destination.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedIssues.map((row) => (
                  <TableRow key={`${row.destination}-${row.itemId}-${row.date}`}>
                    <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                    <TableCell>{row.itemName}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ) : null}
    </div>
  );
}
