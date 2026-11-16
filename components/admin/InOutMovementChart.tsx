"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DailyInOutPoint, StockInReceipt } from "@/lib/analytics";
import { formatNumber } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-media-query";

const IN_FILL = "#047857";
const IN_FILL_ACTIVE = "#065f46";
const OUT_FILL = "#b45309";

interface InOutMovementChartProps {
  points: DailyInOutPoint[];
  receipts: StockInReceipt[];
  category: string;
  destination: string;
}

export function InOutMovementChart({
  points,
  receipts,
  category,
  destination,
}: InOutMovementChartProps) {
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const destNote =
    destination !== "all"
      ? ` Out series limited to ${destination}.`
      : "";

  useEffect(() => {
    setSelectedDate(null);
  }, [category, points]);

  const selectedReceipts = useMemo(() => {
    if (!selectedDate) return [];
    return receipts.filter((row) => row.date === selectedDate);
  }, [receipts, selectedDate]);

  const selectedTotal = useMemo(
    () => selectedReceipts.reduce((sum, row) => sum + row.quantity, 0),
    [selectedReceipts]
  );

  const selectedLabel =
    points.find((point) => point.date === selectedDate)?.label ?? selectedDate;

  function toggleInDay(date: string) {
    if (!date) return;
    setSelectedDate((current) => (current === date ? null : date));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily stock in vs out</CardTitle>
        <p className="text-sm font-normal text-slate-500">
          Received vs used in {category}.{destNote} Click a stock-in bar to see
          what arrived that day. Units may vary within the category.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!points.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No movements in this range.
          </p>
        ) : (
          <div className="h-72 sm:h-96">
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
                  fill={IN_FILL}
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const point = data as unknown as DailyInOutPoint & {
                      payload?: DailyInOutPoint;
                    };
                    const date = point.date ?? point.payload?.date ?? "";
                    toggleInDay(date);
                  }}
                >
                  {points.map((point) => (
                    <Cell
                      key={point.date}
                      fill={
                        selectedDate === point.date ? IN_FILL_ACTIVE : IN_FILL
                      }
                      opacity={
                        !selectedDate || selectedDate === point.date ? 1 : 0.4
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="out"
                  name="Stock out"
                  fill={OUT_FILL}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedDate ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Stock in on {selectedDate}
                  {selectedLabel && selectedLabel !== selectedDate
                    ? ` (${selectedLabel})`
                    : ""}
                </h3>
                <p className="text-xs text-slate-500">
                  {formatNumber(selectedTotal)} received in {category}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(null)}
              >
                Clear day
              </Button>
            </div>
            {selectedReceipts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No stock-in items on this date.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedReceipts.map((row) => (
                    <TableRow key={`${row.date}-${row.itemId}`}>
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
      </CardContent>
    </Card>
  );
}
