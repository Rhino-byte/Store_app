"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchKitchenReport } from "@/lib/api-client";
import { todayDateKey } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";

type KitchenRow = {
  key: string;
  label: string;
  unit: string;
  itemId: string | null;
  itemName: string | null;
  stockIn: number;
  stockOut: number;
  destination: string;
  matched: boolean;
};

export function KitchenDailyReport() {
  const [date, setDate] = useState(() => todayDateKey());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<KitchenRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchKitchenReport(date);
        if (!cancelled) setRows(data.rows);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to load kitchen report"
          );
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Kitchen daily
          </h2>
          <p className="text-sm text-slate-500">
            Priority kitchen items only. Unused rows show 0. Soap, charcoal,
            water, and other store items stay off this list.
          </p>
        </div>
        <div className="w-full space-y-2 sm:w-auto">
          <Label htmlFor="kitchen-report-date">Date</Label>
          <Input
            id="kitchen-report-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="sm:w-48"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState
          label="Loading kitchen report"
          layout="centered"
          className="min-h-[20vh]"
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Stock In</TableHead>
                  <TableHead>Stock Out</TableHead>
                  <TableHead>Destination</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">
                      {row.label}
                      {row.itemName && row.itemName !== row.label ? (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          ({row.itemName})
                        </span>
                      ) : null}
                      {!row.matched ? (
                        <span className="ml-2 text-xs font-normal text-amber-700">
                          not in inventory
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.unit || "—"}</TableCell>
                    <TableCell>{formatNumber(row.stockIn)}</TableCell>
                    <TableCell>{formatNumber(row.stockOut)}</TableCell>
                    <TableCell>{row.destination || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <Card key={row.key}>
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-medium text-slate-900">
                    {row.label}
                    {row.unit ? (
                      <span className="ml-1 font-normal text-slate-500">
                        ({row.unit})
                      </span>
                    ) : null}
                  </p>
                  {!row.matched ? (
                    <p className="text-xs text-amber-700">Not in inventory</p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-slate-500">Stock In</p>
                      <p className="font-medium">{formatNumber(row.stockIn)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Stock Out</p>
                      <p className="font-medium">{formatNumber(row.stockOut)}</p>
                    </div>
                  </div>
                  <p className="text-slate-500">
                    Destination:{" "}
                    <span className="font-medium text-slate-800">
                      {row.destination || "—"}
                    </span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
