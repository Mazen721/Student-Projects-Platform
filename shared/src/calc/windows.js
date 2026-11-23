function toTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Boundaries: null/missing cycle -> false; inclusive [opensAt, closesAt].
export function isRegistrationOpen(cycle, now = new Date()) {
  if (!cycle) return false;
  const opensAt = toTimestamp(cycle.registrationOpensAt);
  const closesAt = toTimestamp(cycle.registrationClosesAt);
  const current = toTimestamp(now);
  if (opensAt === null || closesAt === null || current === null) return false;
  return current >= opensAt && current <= closesAt;
}

export function isProposalResubmitOpen(cycle, now = new Date()) {
  if (!cycle) return false;
  const opensAt = toTimestamp(cycle.registrationOpensAt);
  const deadline = toTimestamp(cycle.proposalDeadline);
  const current = toTimestamp(now);
  if (opensAt === null || deadline === null || current === null) return false;
  return current >= opensAt && current <= deadline;
}

export function getCycleWindowDates(cycle) {
  if (!cycle) return {};
  return {
    registrationOpensAt: cycle.registrationOpensAt || null,
    registrationClosesAt: cycle.registrationClosesAt || null,
    proposalDeadline: cycle.proposalDeadline || null,
  };
}
