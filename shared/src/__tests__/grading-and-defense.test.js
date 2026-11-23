import { describe, expect, it } from 'vitest';
import { DEFENSE_STATES, GRADE_BANDS, ROLES } from '../constants/index.js';
import { defenseMachine } from '../machines/defenseMachine.js';
import {
  computeEvaluatorTotal,
  computePerCriterionBreakdown,
  computeSpread,
  computeStudentFinal,
  computeTeamGrade,
  spreadExceeded,
} from '../calc/grading.js';
import { gradeBand } from '../calc/gradeBands.js';

const sampleRubric = {
  supervisorPct: 40,
  committeePct: 60,
  criteria: [
    { key: 'design', name: 'التصميم', weight: 30, appliesTo: 'team' },
    { key: 'impl', name: 'التنفيذ', weight: 40, appliesTo: 'team' },
    { key: 'presentation', name: 'العرض الفردي', weight: 30, appliesTo: 'individual' },
  ],
};

describe('defenseMachine state transitions and guards', () => {
  it('blocks sign-off when phases are incomplete and allows when all phases are approved', () => {
    const blocked = defenseMachine.evaluate(DEFENSE_STATES.NOT_ELIGIBLE, 'SIGN_OFF', {
      roles: ['primarySupervisor'],
      allPhasesApproved: false,
    });
    expect(blocked).toEqual({ allowed: false, code: 'NOT_ELIGIBLE_FOR_DEFENSE' });

    const allowed = defenseMachine.next(DEFENSE_STATES.NOT_ELIGIBLE, 'SIGN_OFF', {
      roles: ['primarySupervisor'],
      allPhasesApproved: true,
    });
    expect(allowed.to).toBe(DEFENSE_STATES.ELIGIBLE);
  });

  it('rejects scheduling when committee violates COI and allows valid committee by admin', () => {
    const coi = defenseMachine.evaluate(DEFENSE_STATES.ELIGIBLE, 'SCHEDULE', {
      roles: [ROLES.DEPARTMENT_ADMIN],
      validCommittee: false,
    });
    expect(coi).toEqual({ allowed: false, code: 'COI_VIOLATION' });

    const ok = defenseMachine.next(DEFENSE_STATES.ELIGIBLE, 'SCHEDULE', {
      roles: [ROLES.DEPARTMENT_ADMIN],
      validCommittee: true,
    });
    expect(ok.to).toBe(DEFENSE_STATES.SCHEDULED);
  });

  it('bounds deliberation rounds to 3 and requires spread exceeded + complete scores', () => {
    expect(
      defenseMachine.evaluate(DEFENSE_STATES.GRADING, 'UNLOCK_FOR_REVISION', {
        roles: ['committeeChair'],
        allSubmitted: false,
        spreadExceeded: true,
        deliberationCount: 0,
      }).code
    ).toBe('SCORES_INCOMPLETE');

    expect(
      defenseMachine.evaluate(DEFENSE_STATES.GRADING, 'UNLOCK_FOR_REVISION', {
        roles: ['committeeChair'],
        allSubmitted: true,
        spreadExceeded: false,
        deliberationCount: 0,
      }).code
    ).toBe('SPREAD_NOT_EXCEEDED');

    expect(
      defenseMachine.evaluate(DEFENSE_STATES.GRADING, 'UNLOCK_FOR_REVISION', {
        roles: ['committeeChair'],
        allSubmitted: true,
        spreadExceeded: true,
        deliberationCount: 3,
      }).code
    ).toBe('DELIBERATION_LIMIT_REACHED');

    expect(
      defenseMachine.next(DEFENSE_STATES.GRADING, 'UNLOCK_FOR_REVISION', {
        roles: ['committeeChair'],
        allSubmitted: true,
        spreadExceeded: true,
        deliberationCount: 2,
      }).to
    ).toBe(DEFENSE_STATES.DELIBERATION);
  });

  it('requires justification note on finalize when spread is exceeded', () => {
    const missingNote = defenseMachine.evaluate(DEFENSE_STATES.GRADING, 'FINALIZE', {
      roles: ['committeeChair'],
      allSubmitted: true,
      spreadExceeded: true,
      note: '   ',
    });
    expect(missingNote.code).toBe('VALIDATION_ERROR');

    const withNote = defenseMachine.next(DEFENSE_STATES.GRADING, 'FINALIZE', {
      roles: ['committeeChair'],
      allSubmitted: true,
      spreadExceeded: true,
      note: 'تمت المداولة والاتفاق على المتوسط',
    });
    expect(withNote.to).toBe(DEFENSE_STATES.FINALIZED);
  });

  it('enforces reevaluation window and single request limit', () => {
    expect(
      defenseMachine.evaluate(DEFENSE_STATES.FINALIZED, 'REQUEST_REEVAL', {
        roles: [ROLES.STUDENT],
        windowOpen: false,
        alreadyRequested: false,
      }).code
    ).toBe('WINDOW_CLOSED');

    expect(
      defenseMachine.evaluate(DEFENSE_STATES.FINALIZED, 'REQUEST_REEVAL', {
        roles: [ROLES.STUDENT],
        windowOpen: true,
        alreadyRequested: true,
      }).code
    ).toBe('REEVAL_ALREADY_REQUESTED');

    const requested = defenseMachine.next(DEFENSE_STATES.FINALIZED, 'REQUEST_REEVAL', {
      roles: [ROLES.STUDENT],
      windowOpen: true,
      alreadyRequested: false,
    });
    expect(requested.to).toBe(DEFENSE_STATES.REEVALUATION_REQUESTED);

    const reopened = defenseMachine.next(DEFENSE_STATES.REEVALUATION_REQUESTED, 'APPROVE_REEVAL', {
      roles: [ROLES.COLLEGE_ADMIN],
    });
    expect(reopened.to).toBe(DEFENSE_STATES.REEVALUATION_OPEN);

    const refinalized = defenseMachine.next(DEFENSE_STATES.REEVALUATION_OPEN, 'FINALIZE', {
      roles: ['committeeChair'],
      allSubmitted: true,
      spreadExceeded: false,
    });
    expect(refinalized.to).toBe(DEFENSE_STATES.FINALIZED);
  });
});

describe('pure grading calculators and Arabic grade bands', () => {
  it('computes evaluator weighted total across team and individual criteria', () => {
    const total = computeEvaluatorTotal({
      rubric: sampleRubric,
      teamScores: { design: 80, impl: 90 },
      individualScores: { s1: { presentation: 70 }, s2: { presentation: 100 } },
      studentId: 's1',
    });
    // 0.3*80 + 0.4*90 + 0.3*70 = 24 + 36 + 21 = 81
    expect(total).toBe(81);
  });

  it('computes student final grade using 40/60 supervisor-committee split', () => {
    const result = computeStudentFinal({
      supervisorPct: 40,
      committeePct: 60,
      supervisorTotal: 80,
      committeeTotals: [70, 90],
    });
    expect(result).toEqual({
      supervisorTotal: 80,
      committeeAvg: 80,
      final: 80,
    });
  });

  it('computes normalized shared team grade from team-tagged criteria', () => {
    const teamGrade = computeTeamGrade({
      rubric: sampleRubric,
      supervisorPct: 40,
      committeePct: 60,
      supervisorTeamScores: { design: 80, impl: 80 },
      committeeTeamScoresList: [
        { design: 70, impl: 70 },
        { design: 90, impl: 90 },
      ],
    });
    expect(teamGrade).toBe(80);
  });

  it('computes per-criterion breakdown for a student', () => {
    const breakdown = computePerCriterionBreakdown({
      rubric: sampleRubric,
      supervisorScores: {
        teamScores: { design: 80, impl: 90 },
        individualScores: { s1: { presentation: 70 } },
      },
      committeeScoresList: [
        { teamScores: { design: 70, impl: 80 }, individualScores: { s1: { presentation: 60 } } },
        { teamScores: { design: 90, impl: 80 }, individualScores: { s1: { presentation: 80 } } },
      ],
      studentId: 's1',
    });
    expect(breakdown).toEqual([
      { key: 'design', supervisor: 80, committeeAvg: 80 },
      { key: 'impl', supervisor: 90, committeeAvg: 80 },
      { key: 'presentation', supervisor: 70, committeeAvg: 70 },
    ]);
  });

  it.each([
    { totals: [70, 90], threshold: undefined, expectedSpread: 20, expectedExceeded: true },
    { totals: [70, 85], threshold: undefined, expectedSpread: 15, expectedExceeded: false },
    { totals: [75, 86], threshold: 10, expectedSpread: 11, expectedExceeded: true },
    { totals: [82], threshold: undefined, expectedSpread: 0, expectedExceeded: false },
  ])(
    'checks spread $totals with threshold $threshold -> exceeded: $expectedExceeded',
    ({ totals, threshold, expectedSpread, expectedExceeded }) => {
      expect(computeSpread(totals)).toBe(expectedSpread);
      expect(spreadExceeded(totals, threshold)).toBe(expectedExceeded);
    }
  );

  it.each([
    { score: 92, passMark: 60, band: GRADE_BANDS.EXCELLENT, label: 'ممتاز', passed: true },
    { score: 85, passMark: 60, band: GRADE_BANDS.EXCELLENT, label: 'ممتاز', passed: true },
    { score: 78, passMark: 60, band: GRADE_BANDS.VERY_GOOD, label: 'جيد جداً', passed: true },
    { score: 68, passMark: 60, band: GRADE_BANDS.GOOD, label: 'جيد', passed: true },
    { score: 60, passMark: 60, band: GRADE_BANDS.ACCEPTABLE, label: 'مقبول', passed: true },
    { score: 59.99, passMark: 60, band: GRADE_BANDS.FAIL, label: 'راسب', passed: false },
    { score: 68, passMark: 70, band: GRADE_BANDS.FAIL, label: 'راسب', passed: false },
  ])(
    'maps score $score (passMark $passMark) -> $band ($label)',
    ({ score, passMark, band, label, passed }) => {
      expect(gradeBand(score, passMark)).toEqual({ band, label, passed });
    }
  );
});
