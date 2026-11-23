import { streamCertificatePdf } from './certificate.service.js';
import * as defenseService from './defense.service.js';
import * as gradingService from './grading.service.js';

function actorMeta(req) {
  return {
    actor: req.effectiveUser || req.user,
    ip: req.ip,
  };
}

export async function listRubricsHandler(req, res, next) {
  try {
    const data = await defenseService.listRubrics(req.params.id, req.query);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createRubricHandler(req, res, next) {
  try {
    const data = await defenseService.createRubric(req.params.id, req.body, actorMeta(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateRubricHandler(req, res, next) {
  try {
    const data = await defenseService.updateRubric(req.params.id, req.body, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getEligibilityHandler(req, res, next) {
  try {
    const data = await defenseService.getDefenseEligibility(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function signOffDefenseHandler(req, res, next) {
  try {
    const data = await defenseService.signOffForDefense(req.params.id, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listAvailableExaminersHandler(req, res, next) {
  try {
    const data = await defenseService.listActiveExaminersForProject(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function scheduleDefenseHandler(req, res, next) {
  try {
    const data = await defenseService.scheduleDefense(req.params.id, req.body, actorMeta(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function rescheduleDefenseHandler(req, res, next) {
  try {
    const data = await defenseService.rescheduleDefense(req.params.id, req.body, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listDefensesHandler(req, res, next) {
  try {
    const result = await defenseService.listDefenses(req.scopeFilter, req.query);
    res.json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function getDefenseHandler(req, res, next) {
  try {
    const data = await defenseService.getDefenseById(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function inviteExternalExaminerHandler(req, res, next) {
  try {
    const data = await defenseService.inviteExternalExaminer(req.body, actorMeta(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getMyScoresheetHandler(req, res, next) {
  try {
    const data = await gradingService.getMyScoresheet(req.params.id, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function submitMyScoresHandler(req, res, next) {
  try {
    const data = await gradingService.submitMyScores(req.params.id, req.body, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getAllDefenseScoresHandler(req, res, next) {
  try {
    const data = await gradingService.getAllDefenseScores(req.params.id, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function transitionDefenseHandler(req, res, next) {
  try {
    const data = await gradingService.transitionDefense(req.params.id, req.body, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function recordDefenseMinutesHandler(req, res, next) {
  try {
    const data = await gradingService.recordDefenseMinutes(req.params.id, req.body, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function confirmModificationsHandler(req, res, next) {
  try {
    const data = await gradingService.confirmModifications(req.params.id, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getProjectGradesHandler(req, res, next) {
  try {
    const data = await gradingService.getProjectGrades(req.params.id, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function requestReevaluationHandler(req, res, next) {
  try {
    const data = await gradingService.requestReevaluation(req.params.id, req.body, actorMeta(req));
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listReevaluationsHandler(req, res, next) {
  try {
    const result = await gradingService.listReevaluations(req.scopeFilter, req.query);
    res.json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function decideReevaluationHandler(req, res, next) {
  try {
    const data = await gradingService.decideReevaluation(req.params.id, req.body, actorMeta(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function downloadCertificateHandler(req, res, next) {
  try {
    await streamCertificatePdf(req.params.id, req.params.studentId, res);
  } catch (err) {
    next(err);
  }
}
