import { describe, expect, it } from 'vitest';
import { normalizeArabic, normalizeDigits, slugify, trigramSimilarity } from '../text/index.js';
import ar, { pluralAr, t } from '../locales/ar.js';
import {
  academicYearSchema,
  collegeSettingsSchema,
  linkRefSchema,
  paginationQuerySchema,
  registerStudentSchema,
  signUploadSchema,
} from '../schemas/index.js';

describe('Arabic Text Utilities & Locale Helpers', () => {
  it.each([
    ['أحمد إبراهيم آل مكتوم', 'احمد ابراهيم ال مكتوم'],
    ['مُحَمَّدُ بْنُ عَبْدِ اللَّهِ', 'محمد بن عبد الله'],
    ['تـطـبـيـق ذكــي', 'تطبيق ذكي'],
    ['مكتبة جامعيّة كبرى', 'مكتبه جامعيه كبري'],
    ['مشروع ٢٠٢٦ رقم ٤٥٫٥', 'مشروع 2026 رقم 45.5'],
  ])('normalizeArabic(%s) → %s', (raw, expected) => {
    expect(normalizeArabic(raw)).toBe(expected);
  });

  it('normalizeDigits converts Eastern Arabic-Indic digits and decimal separator', () => {
    expect(normalizeDigits('١٢٣٫٤٥')).toBe('123.45');
  });

  it.each([
    ['منصة مشاريع الطلاب ٢٠٢٦', 'منصة-مشاريع-الطلاب-2026'],
    ['Smart Campus App!', 'smart-campus-app'],
    ['   ---   ', 'project'],
  ])('slugify(%s) → %s', (raw, expected) => {
    expect(slugify(raw)).toBe(expected);
  });

  it('trigramSimilarity detects high similarity across Arabic spelling variants', () => {
    const score = trigramSimilarity('نظام إدارة المكتبات الذكي', 'نظام اداره المكتبه الذكيه');
    expect(score).toBeGreaterThan(0.45);
    expect(trigramSimilarity('نظام ري ذكي', 'منصة تجارة إلكترونية')).toBeLessThan(0.25);
  });

  it('t() interpolates variables and pluralAr() handles Arabic plural categories', () => {
    expect(t('notifications.deadlineReminder', { title: 'التقرير النهائي' })).toBe(
      'تذكير: موعد تسليم «التقرير النهائي» قريب'
    );
    expect(ar.errors.NOT_FOUND).toBe('غير مصرح أو غير موجود');

    const forms = { zero: 'لا مشاريع', one: 'مشروع واحد', two: 'مشروعان', few: '{count} مشاريع', many: '{count} مشروعاً', other: '{count} مشروع' };
    expect(pluralAr(1, forms)).toBe('مشروع واحد');
    expect(pluralAr(2, forms)).toBe('مشروعان');
    expect(pluralAr(5, forms)).toBe('5 مشاريع');
  });
});

describe('Core Shared Zod Schemas', () => {
  it('validates student registration and rejects invalid passwords or ObjectIds', () => {
    const valid = registerStudentSchema.safeParse({
      name: 'سارة علي',
      email: 'SARA@MNU.EDU.EG',
      studentId: '20261234',
      password: 'Password1',
      collegeId: '65f000000000000000000011',
      departmentId: '65f000000000000000000021',
    });
    expect(valid.success).toBe(true);
    expect(valid.data.email).toBe('sara@mnu.edu.eg');

    const weakPassword = registerStudentSchema.safeParse({
      name: 'سارة علي',
      email: 'sara@mnu.edu.eg',
      studentId: '20261234',
      password: 'onlyletters',
      collegeId: 'bad-id',
      departmentId: '65f000000000000000000021',
    });
    expect(weakPassword.success).toBe(false);
    const codes = weakPassword.error.issues.map((i) => i.message);
    expect(codes).toContain('validation.invalidPassword');
    expect(codes).toContain('validation.invalidObjectId');
  });

  it('rejects non-HTTPS links and disallowed link hosts for GitHub/YouTube/Drive', () => {
    expect(
      linkRefSchema.safeParse({ kind: 'github', url: 'https://github.com/org/repo' }).success
    ).toBe(true);
    expect(
      linkRefSchema.safeParse({ kind: 'github', url: 'https://evil.com/org/repo' }).success
    ).toBe(false);
    expect(
      linkRefSchema.safeParse({ kind: 'other', url: 'javascript:alert(1)' }).success
    ).toBe(false);
  });

  it('enforces upload size cap <= 10 MB and pagination limit <= 100 with Arabic digits', () => {
    expect(
      signUploadSchema.safeParse({
        purpose: 'deliverable',
        projectId: '65f000000000000000000031',
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        bytes: 10 * 1024 * 1024 + 1,
      }).success
    ).toBe(false);

    const parsedPage = paginationQuerySchema.safeParse({ page: '٢', limit: '٥٠' });
    expect(parsedPage.success).toBe(true);
    expect(parsedPage.data).toEqual({ page: 2, limit: 50 });
    expect(paginationQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('validates college teamSize order and academicYear cycle date ordering', () => {
    expect(collegeSettingsSchema.safeParse({ teamSizeMin: 5, teamSizeMax: 3 }).success).toBe(false);
    expect(
      academicYearSchema.safeParse({
        label: '2026/2027',
        startDate: '2026-09-01',
        endDate: '2027-07-01',
        cycle: {
          registrationOpensAt: '2026-10-10',
          registrationClosesAt: '2026-10-01',
          proposalDeadline: '2026-10-15',
        },
      }).success
    ).toBe(false);
  });
});
