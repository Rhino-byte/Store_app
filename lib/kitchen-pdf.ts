import PDFDocument from "pdfkit";
import {
  formatKitchenReportDateLabel,
  type KitchenDailyRow,
} from "@/lib/kitchen-report";
import { formatNumber } from "@/lib/utils";

const MARGIN = 20;
const TITLE_SIZE = 15;
const BODY_SIZE = 11;
const SMALL_SIZE = 8;
const HEADER_SIZE = 10;
const HEADER_HEIGHT = 20;

export function kitchenReportPdfFilename(dateKey: string): string {
  return `kitchen-daily-${dateKey}.pdf`;
}

function formatClosing(value: number | null): string {
  return value === null ? "—" : formatNumber(value);
}

export function buildKitchenReportPdf(
  dateKey: string,
  rows: KitchenDailyRow[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A5",
      margin: MARGIN,
      info: {
        Title: `Kitchen daily ${dateKey}`,
        Author: "Merry Mary Hotel",
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => {
      chunks.push(chunk);
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - MARGIN * 2;
    const colItem = contentWidth * 0.46;
    const colIn = contentWidth * 0.18;
    const colOut = contentWidth * 0.18;
    const colClose = contentWidth * 0.18;

    function drawTableHeader(y: number) {
      doc.save();
      doc.rect(MARGIN, y, contentWidth, HEADER_HEIGHT).fill("#0f172a");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(HEADER_SIZE);
      const textY = y + 5;
      doc.text("Item", MARGIN + 4, textY, {
        width: colItem - 6,
        lineBreak: false,
      });
      doc.text("In", MARGIN + colItem, textY, {
        width: colIn - 4,
        align: "right",
        lineBreak: false,
      });
      doc.text("Out", MARGIN + colItem + colIn, textY, {
        width: colOut - 4,
        align: "right",
        lineBreak: false,
      });
      doc.text("Close", MARGIN + colItem + colIn + colOut, textY, {
        width: colClose - 4,
        align: "right",
        lineBreak: false,
      });
      doc.restore();
    }

    let y = MARGIN;
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(TITLE_SIZE);
    doc.text("Merry Mary Hotel", MARGIN, y, { width: contentWidth });
    y = doc.y + 3;
    doc.font("Helvetica").fontSize(12).fillColor("#334155");
    doc.text("Kitchen daily report", MARGIN, y, { width: contentWidth });
    y = doc.y + 2;
    doc.fontSize(BODY_SIZE).fillColor("#0f172a");
    doc.text(formatKitchenReportDateLabel(dateKey), MARGIN, y, {
      width: contentWidth,
    });
    y = doc.y + 10;

    drawTableHeader(y);
    y += HEADER_HEIGHT;

    rows.forEach((row, index) => {
      const hasSub = Boolean(row.destination) || !row.matched;
      const rowHeight = hasSub ? 32 : 22;

      if (y + rowHeight > pageHeight - MARGIN - 24) {
        doc.addPage();
        y = MARGIN;
        drawTableHeader(y);
        y += HEADER_HEIGHT;
      }

      if (index % 2 === 0) {
        doc.save();
        doc.rect(MARGIN, y, contentWidth, rowHeight).fill("#f1f5f9");
        doc.restore();
      }

      const textY = y + 4;
      const itemLabel = row.unit ? `${row.label} (${row.unit})` : row.label;
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(BODY_SIZE);
      doc.text(itemLabel, MARGIN + 4, textY, {
        width: colItem - 8,
        lineBreak: false,
      });
      doc.font("Helvetica").fontSize(BODY_SIZE);
      doc.text(formatNumber(row.stockIn), MARGIN + colItem, textY, {
        width: colIn - 4,
        align: "right",
        lineBreak: false,
      });
      doc.text(formatNumber(row.stockOut), MARGIN + colItem + colIn, textY, {
        width: colOut - 4,
        align: "right",
        lineBreak: false,
      });
      doc.text(
        formatClosing(row.closingStock),
        MARGIN + colItem + colIn + colOut,
        textY,
        { width: colClose - 4, align: "right", lineBreak: false }
      );

      if (hasSub) {
        const sub =
          [row.destination, !row.matched ? "Not in inventory" : ""]
            .filter(Boolean)
            .join(" · ") || "";
        if (sub) {
          doc.font("Helvetica").fontSize(SMALL_SIZE).fillColor("#475569");
          doc.text(sub, MARGIN + 4, textY + 13, {
            width: contentWidth - 8,
            lineBreak: false,
          });
        }
      }

      y += rowHeight;
    });

    const footerY = Math.min(y + 10, pageHeight - MARGIN - 12);
    doc.font("Helvetica").fontSize(8).fillColor("#64748b");
    doc.text(
      "Close is stock remaining at end of this day. Store items are omitted.",
      MARGIN,
      footerY,
      { width: contentWidth }
    );

    doc.end();
  });
}

export function buildKitchenReportEmailHtml(
  dateKey: string,
  rows: KitchenDailyRow[]
): string {
  const dateLabel = formatKitchenReportDateLabel(dateKey);
  const bodyRows = rows
    .map((row) => {
      const note = !row.matched
        ? `<div style="color:#b45309;font-size:12px;">Not in inventory</div>`
        : "";
      const dest = row.destination
        ? `<div style="color:#475569;font-size:12px;">${escapeHtml(row.destination)}</div>`
        : "";
      return `<tr>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:14px;word-break:break-word;">
          <strong>${escapeHtml(row.label)}</strong>
          ${row.unit ? `<span style="color:#64748b;"> (${escapeHtml(row.unit)})</span>` : ""}
          ${dest}
          ${note}
        </td>
        <td style="padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:right;white-space:nowrap;width:18%;">${formatNumber(row.stockIn)}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:right;white-space:nowrap;width:18%;">${formatNumber(row.stockOut)}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:right;white-space:nowrap;width:18%;">${formatClosing(row.closingStock)}</td>
      </tr>`;
    })
    .join("");

  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.35;color:#0f172a;max-width:100%;margin:0 auto;">
    <h1 style="font-size:18px;margin:0 0 4px;">Merry Mary Hotel</h1>
    <p style="margin:0 0 12px;color:#334155;">Kitchen daily — ${escapeHtml(dateLabel)}</p>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 6px;background:#0f172a;color:#fff;font-size:13px;">Item</th>
          <th style="text-align:right;padding:8px 4px;background:#0f172a;color:#fff;font-size:13px;width:18%;">In</th>
          <th style="text-align:right;padding:8px 4px;background:#0f172a;color:#fff;font-size:13px;width:18%;">Out</th>
          <th style="text-align:right;padding:8px 4px;background:#0f172a;color:#fff;font-size:13px;width:18%;">Close</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <p style="margin:12px 0 0;color:#475569;font-size:13px;">Close is remaining stock at end of this day. PDF attached.</p>
  </div>`;
}

export function buildKitchenReportEmailText(
  dateKey: string,
  rows: KitchenDailyRow[]
): string {
  const lines = [
    "Merry Mary Hotel — Kitchen daily report",
    formatKitchenReportDateLabel(dateKey),
    "",
    ...rows.map((row) => {
      const unit = row.unit ? ` (${row.unit})` : "";
      const dest = row.destination ? ` dest: ${row.destination}` : "";
      const missing = row.matched ? "" : " [not in inventory]";
      return `${row.label}${unit}: in ${formatNumber(row.stockIn)}, out ${formatNumber(row.stockOut)}, close ${formatClosing(row.closingStock)}${dest}${missing}`;
    }),
    "",
    "PDF attached.",
  ];
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
