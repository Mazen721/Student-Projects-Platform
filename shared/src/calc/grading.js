import { DEFAULT_GRADE_SPREAD_THRESHOLD, RUBRIC_CRITERION_TARGETS } from '../constants/index.js';

function roundTwo(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function average(values = []) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const total = values.reduce((sum, val) => sum + Number(val || 0), 0);
  return total / values.length;
}

function getCriterionScore({ criterion, teamScores = {}, individualScores = {}, studentId }) {
  if (criterion.appliesTo === RUBRIC_CRITERION_TARGETS.INDIVIDUAL) {
    return Number(individualScores?.[String(studentId)]?.[criterion.key] ?? 0);
  }
  return Number(teamScores?.[criterion.key] ?? 0);
}

/**
 * Computes one evaluator's weighted total (0..100) for a student across all rubric criteria.
 */
export function computeEvaluatorTotal({ rubric, teamScores = {}, individualScores = {}, studentId }) {
  const criteria = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
  if (criteria.length === 0) return 0;
  const total = criteria.reduce((sum, criterion) => {
    const score = getCriterionScore({ criterion, teamScores, individualScores, studentId });
    return sum + score * (Number(criterion.weight || 0) / 100);
  }, 0);
  return roundTwo(total);
}

/**
 * Computes a student's final grade from supervisor and committee examiner totals (`FR-086`).
 */
export function computeStudentFinal({
  supervisorPct,
  committeePct,
  supervisorTotal,
  committeeTotals = [],
}) {
  const supTotal = roundTwo(supervisorTotal);
  const commAvg = roundTwo(average(committeeTotals));
  const finalScore = roundTwo(
    (Number(supervisorPct || 0) / 100) * supTotal +
      (Number(committeePct || 0) / 100) * commAvg
  );
  return {
    supervisorTotal: supTotal,
    committeeAvg: commAvg,
    final: finalScore,
  };
}

function computeNormalizedTeamScore(teamCriteria, teamScores = {}) {
  const teamWeightSum = teamCriteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);
  if (teamWeightSum <= 0) return 0;
  const weighted = teamCriteria.reduce(
    (sum, c) => sum + Number(teamScores?.[c.key] ?? 0) * Number(c.weight || 0),
    0
  );
  return weighted / teamWeightSum;
}

/**
 * Computes the shared team grade using only Team-tagged rubric criteria (`FR-086`).
 */
export function computeTeamGrade({
  rubric,
  supervisorPct,
  committeePct,
  supervisorTeamScores = {},
  committeeTeamScoresList = [],
  supervisorTeamScore,
  committeeTeamScores,
}) {
  const supPct = Number(supervisorPct ?? rubric?.supervisorPct ?? 0);
  const commPct = Number(committeePct ?? rubric?.committeePct ?? 0);

  if (typeof supervisorTeamScore === 'number' && Array.isArray(committeeTeamScores)) {
    const commAvg = average(committeeTeamScores);
    return roundTwo((supPct / 100) * supervisorTeamScore + (commPct / 100) * commAvg);
  }

  const teamCriteria = (rubric?.criteria || []).filter(
    (c) => c.appliesTo === RUBRIC_CRITERION_TARGETS.TEAM
  );
  if (teamCriteria.length === 0) return 0;

  const supTeam = computeNormalizedTeamScore(teamCriteria, supervisorTeamScores);
  const commTeams = committeeTeamScoresList.map((scores) =>
    computeNormalizedTeamScore(teamCriteria, scores)
  );
  const commAvg = average(commTeams);
  return roundTwo((supPct / 100) * supTeam + (commPct / 100) * commAvg);
}

/**
 * Computes per-criterion aggregated supervisor score and committee average for a student.
 */
export function computePerCriterionBreakdown({
  rubric,
  supervisorScores = {},
  committeeScoresList = [],
  studentId,
}) {
  const criteria = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
  return criteria.map((criterion) => {
    const supervisor = roundTwo(
      getCriterionScore({
        criterion,
        teamScores: supervisorScores.teamScores,
        individualScores: supervisorScores.individualScores,
        studentId,
      })
    );
    const commValues = committeeScoresList.map((entry) =>
      getCriterionScore({
        criterion,
        teamScores: entry.teamScores,
        individualScores: entry.individualScores,
        studentId,
      })
    );
    return {
      key: criterion.key,
      supervisor,
      committeeAvg: roundTwo(average(commValues)),
    };
  });
}

/**
 * Computes max - min spread among committee examiner totals.
 */
export function computeSpread(committeeTotals = []) {
  if (!Array.isArray(committeeTotals) || committeeTotals.length < 2) return 0;
  const nums = committeeTotals.map((v) => Number(v || 0));
  return roundTwo(Math.max(...nums) - Math.min(...nums));
}

/**
 * Returns true strictly when committee examiner spread exceeds threshold (`FR-086a`, default 15).
 */
export function spreadExceeded(committeeTotals = [], threshold = DEFAULT_GRADE_SPREAD_THRESHOLD) {
  return computeSpread(committeeTotals) > Number(threshold);
}
