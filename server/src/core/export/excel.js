import ExcelJS from 'exceljs';
import { t } from '@spp/shared/locales/ar';

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

export function escapeFormulaCell(value) {
  if (typeof value !== 'string') return value;
  return FORMULA_PREFIX_RE.test(value) ? `'${value}` : value;
}

export function createRtlWorkbook({
  sheetName = 'التقرير',
  metadataRows = [],
  columns = [],
  rows = [],
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: metadataRows.length + 1 }],
  });

  for (const metaRow of metadataRows) {
    const added = sheet.addRow(metaRow.map(escapeFormulaCell));
    added.font = { bold: true };
  }

  const headerRow = sheet.addRow(columns.map((col) => escapeFormulaCell(col.header)));
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF122F4A' },
  };

  columns.forEach((col, index) => {
    const sheetCol = sheet.getColumn(index + 1);
    sheetCol.width = col.width || 22;
    if (col.numFmt) {
      sheetCol.numFmt = col.numFmt;
    }
  });

  if (rows.length === 0) {
    sheet.addRow([t('common.noData')]);
  } else {
    for (const row of rows) {
      const values = columns.map((col) => {
        const raw = row[col.key];
        return typeof raw === 'string' ? escapeFormulaCell(raw) : raw ?? '';
      });
      sheet.addRow(values);
    }
  }

  return workbook;
}

export async function sendExcelResponse(res, workbook, arabicFilename) {
  const encodedName = encodeURIComponent(arabicFilename);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="export.xlsx"; filename*=UTF-8''${encodedName}`
  );
  res.setHeader('Cache-Control', 'no-store');
  await workbook.xlsx.write(res);
  res.end();
}
