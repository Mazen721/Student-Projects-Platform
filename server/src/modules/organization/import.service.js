import ExcelJS from 'exceljs';
import {
  ACCOUNT_TYPES,
  MAX_IMPORT_ROWS,
  ROLES,
} from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { importStudentRowSchema, importSupervisorRowSchema } from '@spp/shared/schemas';
import { recordAudit } from '../../core/audit/audit.service.js';
import { AppError } from '../../core/errors/AppError.js';
import { createRtlWorkbook } from '../../core/export/excel.js';
import {
  createImportedUsers,
  findExistingIdentifiers,
  generateTemporaryPassword,
} from '../auth/index.js';
import College from './college.model.js';
import Department from './department.model.js';
import { getAllowedEmailDomains } from './orgLookup.service.js';

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const STUDENT_HEADERS = ['الاسم الكامل', 'البريد الإلكتروني', 'الرقم الجامعي', 'رمز القسم'];
const SUPERVISOR_HEADERS = ['الاسم الكامل', 'البريد الإلكتروني', 'رمز القسم'];

function readCellText(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell.text !== undefined) return String(cell.text).trim();
  return String(cell).trim();
}

export async function buildImportTemplate(kind) {
  const isStudent = kind === 'students';
  const headers = isStudent ? STUDENT_HEADERS : SUPERVISOR_HEADERS;
  const workbook = createRtlWorkbook({
    sheetName: isStudent ? 'الطلاب' : 'المشرفون',
    columns: headers.map((header, idx) => ({
      header,
      key: `col${idx}`,
      width: 26,
    })),
    rows: [
      isStudent
        ? { col0: 'مثال: سارة أحمد', col1: 'sara@mnu.edu.eg', col2: '20260001', col3: 'CE' }
        : { col0: 'مثال: د. أحمد محمود', col1: 'ahmed@mnu.edu.eg', col2: 'CE' },
    ],
  });

  // Remove sample row so downloaded template has clean headers ready for fill-in
  const sheet = workbook.getWorksheet(1);
  sheet.spliceRows(2, 1);
  return workbook;
}

function extractHeaders(worksheet, expectedHeaders) {
  const headerRow = worksheet.getRow(1);
  const actual = [];
  for (let i = 1; i <= expectedHeaders.length; i += 1) {
    actual.push(readCellText(headerRow.getCell(i).value));
  }
  const matches =
    actual.length === expectedHeaders.length &&
    expectedHeaders.every((expected, idx) => actual[idx] === expected);
  if (!matches) {
    throw new AppError('IMPORT_BAD_TEMPLATE');
  }
}

function parseRowPayload(row, isStudent) {
  if (isStudent) {
    return {
      name: readCellText(row.getCell(1).value),
      email: readCellText(row.getCell(2).value),
      studentId: readCellText(row.getCell(3).value),
      departmentCode: readCellText(row.getCell(4).value),
    };
  }
  return {
    name: readCellText(row.getCell(1).value),
    email: readCellText(row.getCell(2).value),
    departmentCode: readCellText(row.getCell(3).value),
  };
}

function isBlankRow(payload) {
  return Object.values(payload).every((val) => !val);
}

export async function runBulkImport(collegeId, kind, fileBuffer, { actor, ip }) {
  if (!fileBuffer || fileBuffer.length < 4 || !fileBuffer.subarray(0, 4).equals(XLSX_MAGIC)) {
    throw new AppError('IMPORT_BAD_TEMPLATE');
  }

  const college = await College.findById(collegeId).lean();
  if (!college) {
    throw AppError.notFound();
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer);
  } catch {
    throw new AppError('IMPORT_BAD_TEMPLATE');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError('IMPORT_BAD_TEMPLATE');
  }

  const isStudent = kind === 'students';
  const expectedHeaders = isStudent ? STUDENT_HEADERS : SUPERVISOR_HEADERS;
  extractHeaders(worksheet, expectedHeaders);

  if (worksheet.rowCount - 1 > MAX_IMPORT_ROWS) {
    throw new AppError('VALIDATION_ERROR', {
      fields: [{ path: 'file', code: 'validation.maxItems', message: t('validation.maxItems', { max: MAX_IMPORT_ROWS }) }],
    });
  }

  const [departments, allowedDomains] = await Promise.all([
    Department.find({ collegeId, status: 'active' }).select('_id code').lean(),
    getAllowedEmailDomains(),
  ]);
  const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d._id]));

  const schema = isStudent ? importStudentRowSchema : importSupervisorRowSchema;
  const seenEmails = new Set();
  const seenStudentIds = new Set();
  const candidates = [];
  const rejected = [];

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum += 1) {
    const raw = parseRowPayload(worksheet.getRow(rowNum), isStudent);
    if (isBlankRow(raw)) continue;

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      rejected.push({
        row: rowNum,
        field: issue.path.join('.'),
        code: issue.message,
        message: t(issue.message),
      });
      continue;
    }

    const rowData = parsed.data;
    if (isStudent) {
      const domain = rowData.email.split('@')[1]?.toLowerCase() || '';
      if (!allowedDomains.includes(domain)) {
        rejected.push({
          row: rowNum,
          field: 'email',
          code: 'validation.emailDomain',
          message: t('validation.emailDomain'),
        });
        continue;
      }
    }

    const deptId = deptByCode.get(rowData.departmentCode.toUpperCase());
    if (!deptId) {
      rejected.push({
        row: rowNum,
        field: 'departmentCode',
        code: 'errors.NOT_FOUND',
        message: t('errors.NOT_FOUND'),
      });
      continue;
    }

    if (seenEmails.has(rowData.email)) {
      rejected.push({
        row: rowNum,
        field: 'email',
        code: 'errors.DUPLICATE_EMAIL',
        message: t('errors.DUPLICATE_EMAIL'),
      });
      continue;
    }
    if (isStudent && seenStudentIds.has(rowData.studentId)) {
      rejected.push({
        row: rowNum,
        field: 'studentId',
        code: 'errors.DUPLICATE_STUDENT_ID',
        message: t('errors.DUPLICATE_STUDENT_ID'),
      });
      continue;
    }

    seenEmails.add(rowData.email);
    if (isStudent) seenStudentIds.add(rowData.studentId);
    candidates.push({ rowNum, ...rowData, departmentId: deptId });
  }

  const { existingEmails, existingStudentIds } = await findExistingIdentifiers({
    emails: candidates.map((c) => c.email),
    studentIds: isStudent ? candidates.map((c) => c.studentId) : [],
  });

  const validRecords = [];
  for (const item of candidates) {
    if (existingEmails.has(item.email)) {
      rejected.push({
        row: item.rowNum,
        field: 'email',
        code: 'errors.DUPLICATE_EMAIL',
        message: t('errors.DUPLICATE_EMAIL'),
      });
      continue;
    }
    if (isStudent && existingStudentIds.has(item.studentId)) {
      rejected.push({
        row: item.rowNum,
        field: 'studentId',
        code: 'errors.DUPLICATE_STUDENT_ID',
        message: t('errors.DUPLICATE_STUDENT_ID'),
      });
      continue;
    }
    validRecords.push({
      name: item.name,
      email: item.email,
      studentId: isStudent ? item.studentId : undefined,
      temporaryPassword: generateTemporaryPassword(),
      accountType: isStudent ? ACCOUNT_TYPES.STUDENT : ACCOUNT_TYPES.STAFF,
      role: isStudent ? ROLES.STUDENT : ROLES.SUPERVISOR,
      collegeId,
      departmentId: item.departmentId,
    });
  }

  for (let i = 0; i < validRecords.length; i += 100) {
    await createImportedUsers(validRecords.slice(i, i + 100));
  }

  const credWorkbook = createRtlWorkbook({
    sheetName: 'بيانات الدخول المؤقتة',
    metadataRows: [[college.name, isStudent ? 'استيراد الطلاب' : 'استيراد المشرفين']],
    columns: [
      { header: t('auth.name'), key: 'name', width: 24 },
      { header: t('auth.email'), key: 'email', width: 28 },
      ...(isStudent ? [{ header: t('auth.studentId'), key: 'studentId', width: 18 }] : []),
      { header: t('auth.password'), key: 'temporaryPassword', width: 20 },
    ],
    rows: validRecords,
  });

  const credBuffer = Buffer.from(await credWorkbook.xlsx.writeBuffer());
  const credentialsFile = credBuffer.toString('base64');

  rejected.sort((a, b) => a.row - b.row);

  await recordAudit({
    actorId: actor.id,
    actorRole: actor?.roles?.[0]?.role || '',
    action: 'import.run',
    targetType: 'college',
    targetId: college._id,
    scope: { collegeId: college._id },
    after: { kind, created: validRecords.length, rejectedCount: rejected.length },
    ip,
  });

  return {
    created: validRecords.length,
    rejected,
    credentialsFile,
  };
}
