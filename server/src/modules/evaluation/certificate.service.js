import { MODIFICATION_STATES } from '@spp/shared/constants';
import { t } from '@spp/shared/locales/ar';
import { AppError } from '../../core/errors/AppError.js';
import {
  createArabicPdf,
  drawRtlTable,
  drawRtlText,
  sendPdfResponse,
} from '../../core/export/pdf.js';
import { findUsersBasicByIds } from '../auth/index.js';
import { getCollegesAndDepartmentsMap, getUniversityBranding } from '../organization/index.js';
import { getProjectForEvaluation } from '../projects/index.js';
import Defense from './defense.model.js';
import Grade from './grade.model.js';
import Rubric from './rubric.model.js';

function formatArNumber(value) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatArDate(dateValue) {
  if (!dateValue) return '';
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateValue));
}

export async function streamCertificatePdf(projectId, studentId, res) {
  const grade = await Grade.findOne({
    projectId,
    studentId,
    locked: true,
    isLatest: true,
  }).lean();

  if (!grade) {
    throw AppError.notFound();
  }

  const [project, defense, branding, { collegeMap, departmentMap }] = await Promise.all([
    getProjectForEvaluation(projectId),
    Defense.findById(grade.defenseId).lean(),
    getUniversityBranding(),
    getCollegesAndDepartmentsMap([grade.collegeId], [grade.departmentId]),
  ]);

  const rubric = defense ? await Rubric.findById(defense.rubricId).lean() : null;
  const criterionMap = new Map((rubric?.criteria || []).map((c) => [c.key, c]));

  const userIds = [studentId, project.supervision?.primaryId].filter(Boolean);
  const userMap = await findUsersBasicByIds(userIds);
  const student = userMap.get(String(studentId));
  const supervisor = project.supervision?.primaryId
    ? userMap.get(String(project.supervision.primaryId))
    : null;

  const collegeName = collegeMap.get(String(grade.collegeId))?.name || '';
  const deptName = departmentMap.get(String(grade.departmentId))?.name || '';

  const doc = createArabicPdf({
    title: t('evaluation.certificateTitle'),
    subtitle: `${branding.name} — ${collegeName} (${deptName})`,
  });

  const leftMargin = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Gold accent divider under official header
  doc.rect(leftMargin, doc.y, contentWidth, 3).fill('#c9a227');
  doc.y += 14;

  // Summary info box
  const infoStartY = doc.y;
  doc.rect(leftMargin, infoStartY, contentWidth, 128).fillAndStroke('#f4f6f9', '#e3e9f0');

  let cursorY = infoStartY + 12;
  doc.font('Cairo-Bold').fontSize(11).fillColor('#122f4a');
  cursorY = drawRtlText(doc, `${t('projects.title')}: ${project.title}`, leftMargin + 12, cursorY, {
    width: contentWidth - 24,
  });

  doc.font('Cairo').fontSize(10).fillColor('#1a2a3a');
  const studentLine = student?.studentId
    ? `${t('auth.name')}: ${student?.name || ''} (${t('auth.studentId')}: ${student.studentId})`
    : `${t('auth.name')}: ${student?.name || ''}`;
  cursorY = drawRtlText(doc, studentLine, leftMargin + 12, cursorY + 2, {
    width: contentWidth - 24,
  });

  if (supervisor) {
    cursorY = drawRtlText(
      doc,
      `${t('projects.primarySupervisor')}: ${supervisor.name}`,
      leftMargin + 12,
      cursorY + 2,
      { width: contentWidth - 24 }
    );
  }

  const gradeSummary = [
    `${t('evaluation.finalGrade')}: ${formatArNumber(grade.final)} / ١٠٠`,
    `${t('evaluation.gradeBandLabel')}: ${t(`gradeBands.${grade.band}`)}`,
    `${t('evaluation.passStatus')}: ${grade.passed ? t('evaluation.passedLabel') : t('evaluation.failedLabel')}`,
    `${t('evaluation.teamGrade')}: ${formatArNumber(grade.teamGrade)}`,
  ].join('  ·  ');

  doc.font('Cairo-Bold').fontSize(10).fillColor('#122f4a');
  cursorY = drawRtlText(doc, gradeSummary, leftMargin + 12, cursorY + 6, {
    width: contentWidth - 24,
  });

  doc.font('Cairo').fontSize(9).fillColor('#5b6b7c');
  drawRtlText(
    doc,
    `${t('org.yearLabel')}: ${grade.academicYearLabel}  ·  ${formatArDate(grade.finalizedAt)}`,
    leftMargin + 12,
    cursorY + 4,
    { width: contentWidth - 24 }
  );

  doc.y = infoStartY + 144;

  // Criterion breakdown table
  doc.font('Cairo-Bold').fontSize(11).fillColor('#122f4a');
  doc.y = drawRtlText(doc, t('evaluation.criterionBreakdown'), leftMargin, doc.y) + 6;

  const columns = [
    { key: 'committeeAvg', header: t('evaluation.committeeAvg'), width: 95 },
    { key: 'supervisor', header: t('evaluation.supervisorTotal'), width: 95 },
    { key: 'weight', header: t('evaluation.criterionWeight'), width: 75 },
    { key: 'name', header: t('evaluation.criterionName'), width: 250 },
  ];

  const rows = (grade.perCriterion || []).map((pc) => {
    const meta = criterionMap.get(pc.key);
    return {
      name: meta?.name || pc.key,
      weight: `${formatArNumber(meta?.weight || 0)}%`,
      supervisor: formatArNumber(pc.supervisor),
      committeeAvg: formatArNumber(pc.committeeAvg),
    };
  });

  drawRtlTable(doc, { columns, rows, startY: doc.y });

  if (
    defense?.modifications?.required &&
    defense.modifications.state !== MODIFICATION_STATES.CONFIRMED
  ) {
    doc.y += 14;
    doc.font('Cairo-Bold').fontSize(10).fillColor('#b45309');
    drawRtlText(doc, t('evaluation.certificatePendingModsNote'), leftMargin, doc.y);
  }

  const filename = `${t('evaluation.certificate')}-${student?.name || 'student'}.pdf`;
  sendPdfResponse(res, doc, filename);
}
