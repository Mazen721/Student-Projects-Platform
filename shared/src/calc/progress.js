import { DELIVERABLE_STATUSES, WEIGHT_TOLERANCE } from '../constants/index.js';

function roundTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function computePhaseCompletionRatio(phase) {
  const deliverables = Array.isArray(phase.deliverables) ? phase.deliverables : [];
  const required = deliverables.filter((d) => d.required !== false);
  if (required.length === 0) {
    return phase.completedBySupervisor ? 1 : 0;
  }
  const approvedCount = required.filter(
    (d) => d.latestStatus === DELIVERABLE_STATUSES.APPROVED
  ).length;
  return approvedCount / required.length;
}

/**
 * Pure completion % calculator (`FR-056`).
 * Boundary cases: empty phases, 0-required-deliverable phase (supervisor flag),
 * mixed required/optional deliverables, late-approved (counts), milestones/tasks (ignored),
 * and floating-point thirds summing to 100.
 */
export function computeProgress(phases = []) {
  if (!Array.isArray(phases) || phases.length === 0) {
    return { percent: 0, perPhase: [] };
  }

  let weightedSum = 0;
  const perPhase = phases.map((phase) => {
    const ratio = computePhaseCompletionRatio(phase);
    const weight = Number(phase.weight || 0);
    weightedSum += weight * ratio;
    return {
      phaseId: phase.id ?? phase._id ?? phase.phaseId ?? null,
      percent: roundTwo(ratio * 100),
    };
  });

  const allComplete = perPhase.every((entry) => entry.percent === 100);
  let percent = roundTwo(weightedSum);
  if (allComplete && Math.abs(percent - 100) <= WEIGHT_TOLERANCE) {
    percent = 100;
  }
  percent = Math.min(100, Math.max(0, percent));

  return { percent, perPhase };
}
