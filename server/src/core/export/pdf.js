import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import bidiFactory from 'bidi-js';
import { t } from '@spp/shared/locales/ar';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CAIRO_REGULAR_PATH = path.join(__dirname, 'fonts', 'Cairo-Regular.ttf');
export const CAIRO_BOLD_PATH = path.join(__dirname, 'fonts', 'Cairo-Bold.ttf');

const bidi = bidiFactory();

export function toVisualRtl(text) {
  const str = String(text ?? '');
  if (!str) return '';
  return str
    .split('\n')
    .map((line) => {
      if (!line) return '';
      const levels = bidi.getEmbeddingLevels(line, 'rtl');
      return bidi.getReorderedString(line, levels);
    })
    .join('\n');
}

function wrapRtlLines(doc, text, maxWidth) {
  const paragraphs = String(text ?? '').split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const next = `${current} ${words[i]}`;
      if (doc.widthOfString(toVisualRtl(next)) <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

export function drawRtlText(doc, text, x, y, { width, align = 'right', lineGap = 4 } = {}) {
  const targetWidth = width ?? doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const wrapped = wrapRtlLines(doc, text, targetWidth);
  let cursorY = y;
  const lineHeight = doc.currentLineHeight(true) + lineGap;
  for (const line of wrapped) {
    doc.text(toVisualRtl(line), x, cursorY, {
      width: targetWidth,
      align,
      lineBreak: false,
    });
    cursorY += lineHeight;
  }
  return cursorY;
}

export function createArabicPdf({ title, subtitle = '', layout = 'portrait' } = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    layout,
    margin: 40,
    bufferPages: true,
  });

  doc.registerFont('Cairo', CAIRO_REGULAR_PATH);
  doc.registerFont('Cairo-Bold', CAIRO_BOLD_PATH);
  doc.font('Cairo');

  if (title) {
    doc.font('Cairo-Bold').fontSize(16).fillColor('#122f4a');
    const nextY = drawRtlText(doc, title, doc.page.margins.left, doc.page.margins.top);
    doc.y = nextY + 4;
  }
  if (subtitle) {
    doc.font('Cairo').fontSize(10).fillColor('#5b6b7c');
    const nextY = drawRtlText(doc, subtitle, doc.page.margins.left, doc.y);
    doc.y = nextY + 10;
  }
  doc.fillColor('#1a2a3a').fontSize(10);
  return doc;
}

function drawTableHeader(doc, columns, startX, y, rowHeight) {
  let rightEdge = startX + columns.reduce((sum, col) => sum + col.width, 0);
  for (const col of columns) {
    const cellX = rightEdge - col.width;
    doc.rect(cellX, y, col.width, rowHeight).fill('#122f4a');
    doc.font('Cairo-Bold').fontSize(9).fillColor('#ffffff');
    drawRtlText(doc, col.header, cellX + 4, y + 6, { width: col.width - 8 });
    rightEdge -= col.width;
  }
}

export function drawRtlTable(doc, { columns = [], rows = [], startY = doc.y } = {}) {
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalDefined = columns.reduce((sum, col) => sum + (col.width || 0), 0);
  const scale = totalDefined > 0 ? contentWidth / totalDefined : 1;
  const scaledColumns = columns.map((col) => ({
    ...col,
    width: Math.floor((col.width || contentWidth / Math.max(columns.length, 1)) * scale),
  }));

  const rowHeight = 24;
  let y = startY;
  drawTableHeader(doc, scaledColumns, doc.page.margins.left, y, rowHeight);
  y += rowHeight;

  if (rows.length === 0) {
    doc.font('Cairo').fontSize(10).fillColor('#5b6b7c');
    y = drawRtlText(doc, t('common.noData'), doc.page.margins.left, y + 10);
    doc.y = y;
    return y;
  }

  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
      y = doc.page.margins.top;
      drawTableHeader(doc, scaledColumns, doc.page.margins.left, y, rowHeight);
      y += rowHeight;
    }

    let rightEdge = doc.page.margins.left + scaledColumns.reduce((sum, c) => sum + c.width, 0);
    const bg = rowIndex % 2 === 1 ? '#f8fafc' : '#ffffff';
    for (const col of scaledColumns) {
      const cellX = rightEdge - col.width;
      doc.rect(cellX, y, col.width, rowHeight).fillAndStroke(bg, '#e3e9f0');
      doc.font('Cairo').fontSize(9).fillColor('#1a2a3a');
      drawRtlText(doc, String(row[col.key] ?? ''), cellX + 4, y + 6, { width: col.width - 8 });
      rightEdge -= col.width;
    }
    y += rowHeight;
  });

  doc.y = y;
  return y;
}

export function addRtlPageFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const pageNum = i - range.start + 1;
    const footerText = t('common.pageOf', { page: pageNum, pages: range.count });
    doc.font('Cairo').fontSize(8).fillColor('#5b6b7c');
    drawRtlText(
      doc,
      footerText,
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom + 10
    );
  }
}

export function sendPdfResponse(res, doc, arabicFilename) {
  const encodedName = encodeURIComponent(arabicFilename);
  addRtlPageFooters(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="report.pdf"; filename*=UTF-8''${encodedName}`
  );
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);
  doc.end();
}
