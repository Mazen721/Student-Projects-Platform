import { updateProjectStatusFlag } from '../projects/index.js';
import * as boardBomService from './board-bom.service.js';
import * as phasesService from './phases.service.js';
import * as submissionsService from './submissions.service.js';
import { listProjectTimeline } from './timeline.service.js';

function actorMeta(req) {
  return {
    actor: req.effectiveUser || req.user,
    ip: req.ip,
  };
}

export async function listPhaseTemplatesHandler(req, res, next) {
  try {
    const items = await phasesService.listPhaseTemplates(req.params.id);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function createPhaseTemplateHandler(req, res, next) {
  try {
    const item = await phasesService.createPhaseTemplate(req.params.id, req.body, actorMeta(req));
    res.status(201).json({ data: item });
  } catch (err) {
    next(err);
  }
}

export async function updatePhaseTemplateHandler(req, res, next) {
  try {
    const item = await phasesService.updatePhaseTemplate(req.params.id, req.body, actorMeta(req));
    res.json({ data: item });
  } catch (err) {
    next(err);
  }
}

export async function getProjectPhasesHandler(req, res, next) {
  try {
    const data = await phasesService.getProjectPhases(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function adjustPhaseHandler(req, res, next) {
  try {
    const phase = await phasesService.adjustPhase(
      req.params.id,
      req.params.phaseId,
      req.body,
      actorMeta(req)
    );
    res.json({ data: phase });
  } catch (err) {
    next(err);
  }
}

export async function completePhaseHandler(req, res, next) {
  try {
    const data = await phasesService.markZeroDeliverablePhaseComplete(
      req.params.id,
      req.params.phaseId,
      actorMeta(req)
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function reopenPhaseHandler(req, res, next) {
  try {
    const data = await phasesService.reopenZeroDeliverablePhase(
      req.params.id,
      req.params.phaseId,
      req.body,
      actorMeta(req)
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function addMilestoneHandler(req, res, next) {
  try {
    const data = await phasesService.addPhaseMilestone(
      req.params.id,
      req.params.phaseId,
      req.body
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createSubmissionHandler(req, res, next) {
  try {
    const submission = await submissionsService.createSubmission(
      req.params.id,
      req.params.deliverableId,
      req.body,
      actorMeta(req)
    );
    res.status(201).json({ data: submission });
  } catch (err) {
    next(err);
  }
}

export async function listSubmissionsHandler(req, res, next) {
  try {
    const items = await submissionsService.listDeliverableSubmissions(
      req.params.id,
      req.params.deliverableId
    );
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function reviewSubmissionHandler(req, res, next) {
  try {
    const data = await submissionsService.reviewSubmission(
      req.params.id,
      req.body,
      actorMeta(req)
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function setStatusFlagHandler(req, res, next) {
  try {
    const data = await updateProjectStatusFlag(req.params.id, req.body.statusFlag);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getTimelineHandler(req, res, next) {
  try {
    const result = await listProjectTimeline(req.params.id, req.query);
    res.json({ data: result.items, page: result.page });
  } catch (err) {
    next(err);
  }
}

export async function listTasksHandler(req, res, next) {
  try {
    const data = await boardBomService.listTasks(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createTaskHandler(req, res, next) {
  try {
    const task = await boardBomService.createTask(req.params.id, req.body, actorMeta(req));
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
}

export async function updateTaskHandler(req, res, next) {
  try {
    const task = await boardBomService.updateTask(req.params.taskId, req.body);
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
}

export async function deleteTaskHandler(req, res, next) {
  try {
    await boardBomService.deleteTask(req.params.taskId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function listBomHandler(req, res, next) {
  try {
    const data = await boardBomService.listBom(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createBomItemHandler(req, res, next) {
  try {
    const data = await boardBomService.createBomItem(req.params.id, req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateBomItemHandler(req, res, next) {
  try {
    const data = await boardBomService.updateBomItem(req.params.itemId, req.body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function deleteBomItemHandler(req, res, next) {
  try {
    const data = await boardBomService.deleteBomItem(req.params.itemId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listToolsHandler(req, res, next) {
  try {
    const items = await boardBomService.listTools(req.params.id);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function createToolItemHandler(req, res, next) {
  try {
    const item = await boardBomService.createToolItem(req.params.id, req.body);
    res.status(201).json({ data: item });
  } catch (err) {
    next(err);
  }
}

export async function deleteToolItemHandler(req, res, next) {
  try {
    await boardBomService.deleteToolItem(req.params.toolId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function listMeetingsHandler(req, res, next) {
  try {
    const items = await boardBomService.listMeetings(req.params.id);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function createMeetingHandler(req, res, next) {
  try {
    const item = await boardBomService.createMeeting(req.params.id, req.body, actorMeta(req));
    res.status(201).json({ data: item });
  } catch (err) {
    next(err);
  }
}

export async function convertActionItemHandler(req, res, next) {
  try {
    const task = await boardBomService.convertActionItemToTask(
      req.params.meetingId,
      req.params.index,
      actorMeta(req)
    );
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
}
