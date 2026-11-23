import { describe, expect, it } from 'vitest';
import { computeBudget } from '../calc/budget.js';
import { computeProgress } from '../calc/progress.js';

describe('computeProgress (pure completion % calculator)', () => {
  it('computes proportional required deliverable progress across phases', () => {
    const result = computeProgress([
      {
        id: 'ph1',
        weight: 20,
        deliverables: [
          { required: true, latestStatus: 'approved' },
          { required: true, latestStatus: 'submitted' },
        ],
      },
      {
        id: 'ph2',
        weight: 80,
        deliverables: [
          { required: true, latestStatus: 'none' },
          { required: true, latestStatus: 'changes_requested' },
        ],
      },
    ]);

    expect(result.percent).toBe(10);
    expect(result.perPhase).toEqual([
      { phaseId: 'ph1', percent: 50 },
      { phaseId: 'ph2', percent: 0 },
    ]);
  });

  it('earns weight for a zero-deliverable phase only when marked complete by supervisor', () => {
    const incomplete = computeProgress([
      { id: 'ph1', weight: 30, deliverables: [], completedBySupervisor: null },
      {
        id: 'ph2',
        weight: 70,
        deliverables: [{ required: true, latestStatus: 'approved' }],
      },
    ]);
    expect(incomplete.percent).toBe(70);
    expect(incomplete.perPhase[0].percent).toBe(0);

    const complete = computeProgress([
      {
        id: 'ph1',
        weight: 30,
        deliverables: [],
        completedBySupervisor: { by: 'sup1', at: new Date('2026-10-01') },
      },
      {
        id: 'ph2',
        weight: 70,
        deliverables: [{ required: true, latestStatus: 'approved' }],
      },
    ]);
    expect(complete.percent).toBe(100);
    expect(complete.perPhase[0].percent).toBe(100);
  });

  it('counts approved late deliverables and ignores optional deliverables, milestones, and tasks', () => {
    const result = computeProgress([
      {
        id: 'ph1',
        weight: 40,
        milestones: [
          { title: 'M1', done: false },
          { title: 'M2', done: true },
        ],
        tasks: [{ column: 'todo' }],
        deliverables: [
          { required: true, latestStatus: 'approved', isLate: true },
          { required: false, latestStatus: 'none' },
        ],
      },
      {
        id: 'ph2',
        weight: 60,
        deliverables: [
          { required: true, latestStatus: 'approved', isLate: false },
          { required: true, latestStatus: 'rejected' },
        ],
      },
    ]);

    expect(result.percent).toBe(70);
    expect(result.perPhase).toEqual([
      { phaseId: 'ph1', percent: 100 },
      { phaseId: 'ph2', percent: 50 },
    ]);
  });

  it('recalculates downward when an approval is revoked or zero-deliverable phase reopened', () => {
    const before = computeProgress([
      {
        id: 'ph1',
        weight: 50,
        deliverables: [{ required: true, latestStatus: 'approved' }],
      },
      {
        id: 'ph2',
        weight: 50,
        deliverables: [],
        completedBySupervisor: { by: 'sup1', at: new Date() },
      },
    ]);
    expect(before.percent).toBe(100);

    const afterRevoke = computeProgress([
      {
        id: 'ph1',
        weight: 50,
        deliverables: [{ required: true, latestStatus: 'changes_requested' }],
      },
      {
        id: 'ph2',
        weight: 50,
        deliverables: [],
        completedBySupervisor: null,
      },
    ]);
    expect(afterRevoke.percent).toBe(0);
  });

  it('rounds cleanly to exact 100 when all weighted phases are complete despite thirds', () => {
    const result = computeProgress([
      {
        id: 'ph1',
        weight: 33.33,
        deliverables: [{ required: true, latestStatus: 'approved' }],
      },
      {
        id: 'ph2',
        weight: 33.33,
        deliverables: [{ required: true, latestStatus: 'approved' }],
      },
      {
        id: 'ph3',
        weight: 33.34,
        deliverables: [{ required: true, latestStatus: 'approved' }],
      },
    ]);
    expect(result.percent).toBe(100);
  });

  it('handles empty phases array safely', () => {
    expect(computeProgress([])).toEqual({ percent: 0, perPhase: [] });
  });
});

describe('computeBudget (pure BOM calculator)', () => {
  it.each([
    { items: [], expected: 0 },
    { items: [{ quantity: 2, unitPrice: 125.5 }], expected: 251 },
    {
      items: [
        { quantity: 3, unitPrice: 100.33 },
        { quantity: 1, unitPrice: 49.01 },
      ],
      expected: 350,
    },
  ])('computes total BOM cost -> $expected', ({ items, expected }) => {
    expect(computeBudget(items)).toBe(expected);
  });
});
