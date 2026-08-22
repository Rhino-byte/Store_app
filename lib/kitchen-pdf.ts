import PDFDocument from "pdfkit";
import {
  formatKitchenReportDateLabel,
  type KitchenDailyRow,
} from "@/lib/kitchen-report";
import { formatNumber } from "@/lib/utils";

const MARGIN = 28;
const TITLE_SIZE = 16;
const BODY_SIZE = 12;
const SMALL_SIZE = 9;
const HEADER_SIZE = 11;
const HEADER_HEIGHT = 22;

export function kitchenReportPdfFilename(dateKey: string): string {
  return `kitchen-daily-${dateKey}.pdf`;
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
    const colUnit = contentWidth * 0.16;
    const colIn = contentWidth * 0.19;
    const colOut = contentWidth * 0.19;

    function drawTableHeader(y: number) {
      doc.save();
      doc.rect(MARGIN, y, contentWidth, HEADER_HEIGHT).fill("#0f172a");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(HEADER_SIZE);
      const textY = y + 6;
      doc.text("Item", MARGIN + 6, textY, {
        width: colItem - 8,
        lineBreak: false,
      });
      doc.text("Unit", MARGIN + colItem, textY, {
        width: colUnit,
        lineBreak: false,
      });
      doc.text("In", MARGIN + colItem + colUnit, textY, {
        width: colIn - 6,
        align: "right",
        lineBreak: false,
      });
      doc.text("Out", MARGIN + colItem + colUnit + colIn, textY, {
        width: colOut - 6,
        align: "right",
        lineBreak: false,
      });
      doc.restore();
    }

    let y = MARGIN;
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(TITLE_SIZE);
    doc.text("Merry Mary Hotel", MARGIN, y, { width: contentWidth });
    y = doc.y + 4;
    doc.font("Helvetica").fontSize(13).fillColor("#334155");
    doc.text("Kitchen daily report", MARGIN, y, { width: contentWidth });
    y = doc.y + 2;
    doc.fontSize(BODY_SIZE).fillColor("#0f172a");
    doc.text(formatKitchenReportDateLabel(dateKey), MARGIN, y, {
      width: contentWidth,
    });
    y = doc.y + 12;

    drawTableHeader(y);
    y += HEADER_HEIGHT;

    rows.forEach((row, index) => {
      const hasSub = Boolean(row.destination) || !row.matched;
      const rowHeight = hasSub ? 36 : 24;

      if (y + rowHeight > pageHeight - MARGIN - 28) {
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

      const textY = y + 5;
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(BODY_SIZE);
      doc.text(row.label, MARGIN + 6, textY, {
        width: colItem - 10,
        lineBreak: false,
      });
      doc.font("Helvetica").fontSize(BODY_SIZE);
      doc.text(row.unit || "—", MARGIN + colItem, textY, {
        width: colUnit,
        lineBreak: false,
      });
      doc.text(formatNumber(row.stockIn), MARGIN + colItem + colUnit, textY, {
        width: colIn - 6,
        align: "right",
        lineBreak: false,
      });
      doc.text(
        formatNumber(row.stockOut),
        MARGIN + colItem + colUnit + colIn,
        textY,
        { width: colOut - 6, align: "right", lineBreak: false }
      );

      if (hasSub) {
        const sub =
          [row.destination, !row.matched ? "Not in inventory" : ""]
            .filter(Boolean)
            .join(" · ") || "";
        doc.font("Helvetica").fontSize(SMALL_SIZE).fillColor("#475569");
        doc.text(sub, MARGIN + 6, textY + 14, {
          width: contentWidth - 12,
          lineBreak: false,
        });
      }

      y += rowHeight;
    });

    const footerY = Math.min(y + 12, pageHeight - MARGIN - 14);
    doc.font("Helvetica").fontSize(8).fillColor("#64748b");
    doc.text(
      "Priority kitchen items only. Soap, charcoal, water, and other store items are omitted.",
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
        ? `<div style="color:#b45309;font-size:13px;">Not in inventory</div>`
        : "";
      const dest = row.destination
        ? `<div style="color:#475569;font-size:13px;">${escapeHtml(row.destination)}</div>`
        : "";
      return `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:16px;">
          <strong>${escapeHtml(row.label)}</strong>
          ${row.unit ? `<span style="color:#64748b;"> (${escapeHtml(row.unit)})</span>` : ""}
          ${dest}
          ${note}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:16px;text-align:right;white-space:nowrap;">${formatNumber(row.stockIn)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:16px;text-align:right;white-space:nowrap;">${formatNumber(row.stockOut)}</td>
      </tr>`;
    })
    .join("");

  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.4;color:#0f172a;max-width:480px;margin:0 auto;">
    <h1 style="font-size:20px;margin:0 0 4px;">Merry Mary Hotel</h1>
    <p style="margin:0 0 16px;color:#334155;">Kitchen daily — ${escapeHtml(dateLabel)}</p>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;background:#0f172a;color:#fff;font-size:14px;">Item</th>
          <th style="text-align:right;padding:8px;background:#0f172a;color:#fff;font-size:14px;">In</th>
          <th style="text-align:right;padding:8px;background:#0f172a;color:#fff;font-size:14px;">Out</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <p style="margin:16px 0 0;color:#475569;font-size:14px;">A phone-friendly PDF is attached.</p>
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
      return `${row.label}${unit}: in ${formatNumber(row.stockIn)}, out ${formatNumber(row.stockOut)}${dest}${missing}`;
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
