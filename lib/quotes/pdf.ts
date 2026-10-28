import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { QuoteRecord } from "./types";

const ink = rgb(0.12, 0.13, 0.11);
const muted = rgb(0.38, 0.39, 0.34);
const orange = rgb(0.91, 0.37, 0.14);
const cream = rgb(0.97, 0.96, 0.91);
const line = rgb(0.84, 0.82, 0.74);

function money(value: number, currency: string) {
  return `${currency} ${value.toFixed(2)}`;
}

function safeText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}

function drawRight(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, color = ink) {
  page.drawText(text, { x: x - font.widthOfTextAtSize(text, size), y, size, font, color });
}

export async function createQuotePdf(quote: QuoteRecord, sellerName: string, sellerEmail: string) {
  const document = await PDFDocument.create();
  document.setTitle(`${quote.quoteNumber} - ${quote.projectName}`);
  document.setAuthor("Spoolwise");
  document.setCreator("Spoolwise Premium");
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();
  const left = 48;
  const right = width - 48;

  page.drawRectangle({ x: 0, y: 0, width, height: page.getHeight(), color: cream });
  page.drawRectangle({ x: 0, y: 786, width, height: 56, color: ink });
  page.drawCircle({ x: 65, y: 814, size: 15, borderColor: orange, borderWidth: 4 });
  page.drawCircle({ x: 65, y: 814, size: 6, borderColor: orange, borderWidth: 2 });
  page.drawText("SPOOLWISE", { x: 91, y: 806, size: 17, font: bold, color: cream });
  drawRight(page, bold, "QUOTE", right, 806, 16, orange);

  page.drawText(safeText(sellerName) || "3D printing studio", { x: left, y: 752, size: 16, font: bold, color: ink });
  page.drawText(safeText(sellerEmail), { x: left, y: 734, size: 9, font: regular, color: muted });
  drawRight(page, bold, quote.quoteNumber, right, 752, 11);
  drawRight(page, regular, `Created ${new Date(quote.createdAt).toLocaleDateString("en-GB")}`, right, 734, 9, muted);
  if (quote.validUntil) drawRight(page, regular, `Valid until ${new Date(quote.validUntil).toLocaleDateString("en-GB")}`, right, 718, 9, muted);

  page.drawLine({ start: { x: left, y: 700 }, end: { x: right, y: 700 }, thickness: 1, color: line });
  page.drawText("PREPARED FOR", { x: left, y: 674, size: 8, font: bold, color: orange });
  page.drawText(safeText(quote.customerName) || "Customer", { x: left, y: 653, size: 13, font: bold, color: ink });
  if (quote.customerEmail) page.drawText(safeText(quote.customerEmail), { x: left, y: 636, size: 9, font: regular, color: muted });
  page.drawText("PROJECT", { x: 310, y: 674, size: 8, font: bold, color: orange });
  page.drawText(safeText(quote.projectName), { x: 310, y: 653, size: 13, font: bold, color: ink });
  const printMeta = [
    quote.data.printerName && `Printer: ${safeText(quote.data.printerName)}`,
    quote.data.slicer && `Slicer: ${safeText(quote.data.slicer)}`,
    quote.data.durationMinutes > 0 && `Print time: ${(quote.data.durationMinutes / 60).toFixed(1)}h`,
  ].filter(Boolean).join("  |  ");
  if (printMeta) page.drawText(printMeta, { x: 310, y: 636, size: 8, font: regular, color: muted });

  let y = 595;
  page.drawRectangle({ x: left, y, width: right - left, height: 28, color: ink });
  page.drawText("ITEM", { x: left + 12, y: y + 10, size: 8, font: bold, color: cream });
  page.drawText("WEIGHT", { x: 370, y: y + 10, size: 8, font: bold, color: cream });
  drawRight(page, bold, "AMOUNT", right - 12, y + 10, 8, cream);
  y -= 29;
  for (const item of quote.data.items.slice(0, 8)) {
    page.drawText(safeText(`${item.name} - ${item.material} / ${item.color}`).slice(0, 54), { x: left + 12, y: y - 17, size: 9, font: regular, color: ink });
    page.drawText(`${item.grams.toFixed(1)} g`, { x: 370, y: y - 17, size: 9, font: regular, color: muted });
    drawRight(page, regular, money(item.amount, quote.currency), right - 12, y - 17, 9);
    page.drawLine({ start: { x: left, y: y - 28 }, end: { x: right, y: y - 28 }, thickness: 0.6, color: line });
    y -= 38;
  }

  const summaryTop = Math.min(y - 18, 285);
  page.drawRectangle({ x: 315, y: summaryTop - 146, width: right - 315, height: 146, color: rgb(1, 1, 1), borderColor: line, borderWidth: 1 });
  const rows: Array<[string, number, boolean?]> = [
    ["Production cost", quote.totalCost],
    [`Markup (${quote.data.costs.profitPercent.toFixed(0)}%)`, quote.data.costs.profit],
    ["Quoted price", quote.suggestedPrice, true],
  ];
  let summaryY = summaryTop - 32;
  for (const [label, value, emphasis] of rows) {
    page.drawText(label, { x: 331, y: summaryY, size: emphasis ? 11 : 9, font: emphasis ? bold : regular, color: emphasis ? ink : muted });
    drawRight(page, emphasis ? bold : regular, money(value, quote.currency), right - 16, summaryY, emphasis ? 13 : 9, emphasis ? orange : ink);
    summaryY -= emphasis ? 45 : 29;
  }

  if (quote.data.notes) {
    page.drawText("NOTES", { x: left, y: summaryTop - 18, size: 8, font: bold, color: orange });
    const notes = safeText(quote.data.notes).slice(0, 330);
    const words = notes.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (regular.widthOfTextAtSize(candidate, 9) > 225) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    lines.slice(0, 6).forEach((text, index) => page.drawText(text, { x: left, y: summaryTop - 39 - index * 14, size: 9, font: regular, color: muted }));
  }

  page.drawLine({ start: { x: left, y: 68 }, end: { x: right, y: 68 }, thickness: 1, color: line });
  page.drawText("Generated with Spoolwise Premium", { x: left, y: 46, size: 8, font: regular, color: muted });
  drawRight(page, regular, "This quote is not a tax invoice.", right, 46, 8, muted);

  return document.save();
}
