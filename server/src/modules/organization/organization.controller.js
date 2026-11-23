import { sendExcelResponse } from '../../core/export/excel.js';
import * as importService from './import.service.js';
import * as orgService from './organization.service.js';

function actorContext(req) {
  return {
    actor: req.effectiveUser || req.user,
    ip: req.ip,
  };
}

export async function getPublicUniversityHandler(_req, res, next) {
  try {
    const data = await orgService.getPublicUniversity();
    res.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getPublicCollegesHandler(_req, res, next) {
  try {
    const data = await orgService.listPublicColleges();
    res.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getPublicCollegeDepartmentsHandler(req, res, next) {
  try {
    const data = await orgService.listPublicCollegeDepartments(req.params.id);
    res.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getUniversityHandler(_req, res, next) {
  try {
    const data = await orgService.getUniversity();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateUniversitySettingsHandler(req, res, next) {
  try {
    const data = await orgService.updateUniversitySettings(req.body, actorContext(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listCollegesHandler(req, res, next) {
  try {
    const { items, page } = await orgService.listColleges(req.scopeFilter, req.query);
    res.status(200).json({ data: items, page });
  } catch (err) {
    next(err);
  }
}

export async function createCollegeHandler(req, res, next) {
  try {
    const data = await orgService.createCollege(req.body, actorContext(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getCollegeHandler(req, res, next) {
  try {
    const data = await orgService.getCollegeById(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateCollegeHandler(req, res, next) {
  try {
    const data = await orgService.updateCollege(req.params.id, req.body, actorContext(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateCollegeSettingsHandler(req, res, next) {
  try {
    const data = await orgService.updateCollegeSettings(req.params.id, req.body, actorContext(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function deactivateCollegeHandler(req, res, next) {
  try {
    const data = await orgService.deactivateCollege(req.params.id, req.body, actorContext(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listDepartmentsHandler(req, res, next) {
  try {
    const { items, page } = await orgService.listDepartments(req.params.id, req.query);
    res.status(200).json({ data: items, page });
  } catch (err) {
    next(err);
  }
}

export async function createDepartmentHandler(req, res, next) {
  try {
    const data = await orgService.createDepartment(req.params.id, req.body, actorContext(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateDepartmentHandler(req, res, next) {
  try {
    const data = await orgService.updateDepartment(req.params.id, req.body, actorContext(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function deactivateDepartmentHandler(req, res, next) {
  try {
    const data = await orgService.deactivateDepartment(req.params.id, req.body, actorContext(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listAcademicYearsHandler(req, res, next) {
  try {
    const data = await orgService.listAcademicYears(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createAcademicYearHandler(req, res, next) {
  try {
    const data = await orgService.createAcademicYear(req.params.id, req.body, actorContext(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateAcademicYearHandler(req, res, next) {
  try {
    const data = await orgService.updateAcademicYear(req.params.id, req.body, actorContext(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function setCurrentAcademicYearHandler(req, res, next) {
  try {
    const data = await orgService.setCurrentAcademicYear(req.params.id, actorContext(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function rolloverAcademicYearHandler(req, res, next) {
  try {
    const data = await orgService.rolloverAcademicYear(req.params.id, actorContext(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function downloadImportTemplateHandler(req, res, next) {
  try {
    const workbook = await importService.buildImportTemplate(req.query.kind);
    const filename =
      req.query.kind === 'students' ? 'قالب-استيراد-الطلاب.xlsx' : 'قالب-استيراد-المشرفين.xlsx';
    await sendExcelResponse(res, workbook, filename);
  } catch (err) {
    next(err);
  }
}

export async function runBulkImportHandler(req, res, next) {
  try {
    const data = await importService.runBulkImport(
      req.params.id,
      req.query.kind,
      req.file?.buffer,
      actorContext(req)
    );
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listAuditLogsHandler(req, res, next) {
  try {
    const { items, page } = await orgService.listScopedAuditLogs(req.scopeFilter, req.query);
    res.status(200).json({ data: items, page });
  } catch (err) {
    next(err);
  }
}

export async function getHomeDashboardHandler(req, res, next) {
  try {
    const data = await orgService.getHomeDashboard(req.user, req.get('x-role-context'));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
