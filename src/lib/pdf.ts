import PDFDocument from "pdfkit";

interface Column {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "right" | "center";
}

/**
 * Builds a simple landscape PDF table report.
 * Returns a Buffer.
 */
export async function buildPdfReport(options: {
  title: string;
  subtitle?: string;
  columns: Column[];
  rows: Record<string, string | number>[];
  landscape?: boolean;
}): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    layout: options.landscape === false ? "portrait" : "landscape",
    margin: 36,
    info: {
      Title: options.title,
      Author: process.env.ORG_NAME || "Membership System",
      Creator: "Membership Management System",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const orgName = process.env.ORG_NAME || "Membership System";
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  let y = doc.page.margins.top;

  // Header
  doc
    .fillColor("#1d4ed8")
    .fontSize(18)
    .text(orgName, left, y, { width: pageWidth });
  y += 26;

  doc
    .fillColor("#111827")
    .fontSize(14)
    .text(options.title, left, y, { width: pageWidth });
  y += 20;

  if (options.subtitle) {
    doc.fillColor("#6b7280").fontSize(9).text(options.subtitle, left, y, { width: pageWidth });
    y += 16;
  }

  doc
    .fillColor("#6b7280")
    .fontSize(8)
    .text(`Generated ${new Date().toLocaleString()}`, left, y, { width: pageWidth });
  y += 22;

  // Column layout
  const totalWeight = options.columns.reduce((s, c) => s + (c.width ?? 1), 0);
  const widths = options.columns.map((c) => (pageWidth * (c.width ?? 1)) / totalWeight);

  const rowHeight = 20;
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  function ensureSpace(needed: number) {
    if (y + needed > pageBottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawTableHeader();
    }
  }

  function drawTableHeader() {
    let x = left;
    doc.save();
    doc.rect(left, y, pageWidth, rowHeight).fill("#f3f4f6");
    doc.restore();

    doc.fillColor("#374151").fontSize(9);
    options.columns.forEach((col, i) => {
      doc.text(col.header, x + 4, y + 6, {
        width: widths[i] - 8,
        align: col.align ?? "left",
        ellipsis: true,
        lineBreak: false,
      });
      x += widths[i];
    });

    y += rowHeight;
    doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor("#e5e7eb").stroke();
  }

  drawTableHeader();

  // Rows
  for (const row of options.rows) {
    ensureSpace(rowHeight);

    // Zebra striping
    if (options.rows.indexOf(row) % 2 === 1) {
      doc.save();
      doc.rect(left, y, pageWidth, rowHeight).fill("#fafafa");
      doc.restore();
    }

    let x = left;
    doc.fillColor("#111827").fontSize(9);
    options.columns.forEach((col, i) => {
      const value = row[col.key];
      doc.text(value === undefined || value === null ? "-" : String(value), x + 4, y + 6, {
        width: widths[i] - 8,
        align: col.align ?? "left",
        ellipsis: true,
        lineBreak: false,
      });
      x += widths[i];
    });

    y += rowHeight;
    doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor("#f3f4f6").stroke();
  }

  // Footer with page numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fillColor("#9ca3af")
      .fontSize(8)
      .text(
        `Page ${i - range.start + 1} of ${range.count}`,
        doc.page.margins.left,
        doc.page.height - doc.page.margins.bottom + 12,
        { width: pageWidth, align: "center" }
      );
  }

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}