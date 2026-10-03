"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KitchenReportItemPicker } from "@/components/admin/KitchenReportItemPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchKitchenReport } from "@/lib/api-client";
import { todayDateKey } from "@/lib/dates";
import {
  kitchenHasMissingOutPrice,
  kitchenOutValueTotal,
  type KitchenDailyRow,
} from "@/lib/kitchen-report";
import { formatMoney, formatNumber } from "@/lib/utils";

function formatClosing(value: number | null): string {
  return value === null ? "—" : formatNumber(value);
}

function formatValue(value: number | null): string {
  return value === null ? "—" : formatMoney(value);
}

export function KitchenDailyReport() {
  const [date, setDate] = useState(() => todayDateKey());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<KitchenDailyRow[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  const reloadPreview = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

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
  }, [date, reloadToken]);

  const valueTotal = useMemo(() => kitchenOutValueTotal(rows), [rows]);
  const missingPrice = useMemo(
    () => kitchenHasMissingOutPrice(rows),
    [rows]
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Kitchen daily
          </h2>
          <p className="text-sm text-slate-500">
            Value is stock out × unit price from Sheet1. Use Edit PDF items to
            change the daily kitchen list.
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

      <KitchenReportItemPicker onSaved={reloadPreview} />

      {loading ? (
        <LoadingState
          label="Loading kitchen report"
          layout="centered"
          className="min-h-[20vh]"
        />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          No items on the kitchen daily PDF yet. Add items above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full table-fixed text-xs sm:text-sm">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-2 py-2 text-left font-medium">Item</th>
                <th className="px-1.5 py-2 text-right font-medium">In</th>
                <th className="px-1.5 py-2 text-right font-medium">Out</th>
                <th className="px-1.5 py-2 text-right font-medium">Close</th>
                <th className="px-1.5 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.key}
                  className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                >
                  <td className="px-2 py-2 align-top">
                    <p className="font-medium leading-snug text-slate-900">
                      {row.label}
                      {row.unit ? (
                        <span className="ml-1 font-normal text-slate-500">
                          ({row.unit})
                        </span>
                      ) : null}
                    </p>
                    {row.destination ? (
                      <p className="mt-0.5 break-words text-[11px] leading-snug text-slate-500">
                        {row.destination}
                      </p>
                    ) : null}
                    {!row.matched ? (
                      <p className="mt-0.5 text-[11px] text-amber-700">
                        Not in inventory
                      </p>
                    ) : null}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums align-top">
                    {formatNumber(row.stockIn)}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums align-top">
                    {formatNumber(row.stockOut)}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums align-top font-medium">
                    {formatClosing(row.closingStock)}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums align-top">
                    {formatValue(row.outValue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-100">
                <td
                  colSpan={4}
                  className="px-2 py-2 font-semibold text-slate-900"
                >
                  Total
                </td>
                <td className="px-1.5 py-2 text-right tabular-nums font-semibold text-slate-900">
                  {formatMoney(valueTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
          {missingPrice ? (
            <p className="border-t border-slate-200 px-2 py-2 text-[11px] text-amber-700 sm:text-xs">
              Some items have stock out but no unit price and are omitted from
              the total.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
