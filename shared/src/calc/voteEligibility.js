import { ACCOUNT_TYPES, USER_STATUSES } from '../constants/index.js';

const HOUR_MS = 60 * 60 * 1000;
const UNIVERSITY_ACCOUNT_TYPES = new Set([ACCOUNT_TYPES.STUDENT, ACCOUNT_TYPES.STAFF]);

function idOf(value) {
  if (!value) return null;
  return String(value._id ?? value);
}

function includesUser(list, userId) {
  if (!Array.isArray(list) || !userId) return false;
  return list.some((entry) => idOf(entry) === userId);
}

function isSelfVoter(userId, project) {
  if (!userId || !project) return false;
  if (includesUser(project.activeMemberIds, userId)) return true;
  if (idOf(project.team?.leaderId) === userId) return true;
  if ((project.team?.members || []).some((member) => idOf(member.userId) === userId)) {
    return true;
  }
  const supervision = project.supervision || {};
  if (idOf(supervision.primaryId) === userId) return true;
  if (idOf(supervision.reviewerId) === userId) return true;
  if (includesUser(supervision.coSupervisorIds, userId)) return true;
  if (includesUser(supervision.mentorIds, userId)) return true;
  return false;
}

export function voteEligibility({
  user,
  project,
  competition = null,
  now = new Date(),
  minAccountAgeHours = 0,
} = {}) {
  if (!user || user.status !== USER_STATUSES.ACTIVE) {
    return { eligible: false, code: 'ACCOUNT_INACTIVE' };
  }

  const userId = idOf(user);
  const projectId = idOf(project);

  const createdAt = user.createdAt ? new Date(user.createdAt) : null;
  const minAgeMs = Number(minAccountAgeHours || 0) * HOUR_MS;
  if (createdAt && minAgeMs > 0) {
    const availableAt = new Date(createdAt.getTime() + minAgeMs);
    if (new Date(now).getTime() < availableAt.getTime()) {
      return { eligible: false, code: 'VOTE_ACCOUNT_TOO_NEW', availableAt };
    }
  }

  if (isSelfVoter(userId, project)) {
    return { eligible: false, code: 'SELF_VOTE' };
  }

  if (competition) {
    const startsAt = competition.startsAt ? new Date(competition.startsAt).getTime() : null;
    const endsAt = competition.endsAt ? new Date(competition.endsAt).getTime() : null;
    const current = new Date(now).getTime();
    if ((startsAt != null && current < startsAt) || (endsAt != null && current >= endsAt)) {
      return { eligible: false, code: 'COMPETITION_CLOSED' };
    }

    const eligibleProjectIds = competition.eligibleProjectIds || [];
    if (eligibleProjectIds.length > 0 && !eligibleProjectIds.map(String).includes(projectId)) {
      return { eligible: false, code: 'PROJECT_NOT_ELIGIBLE' };
    }

    if (competition.voterRestriction === 'university_only') {
      if (!UNIVERSITY_ACCOUNT_TYPES.has(user.accountType)) {
        return { eligible: false, code: 'VOTER_NOT_UNIVERSITY' };
      }
    }
  }

  return { eligible: true };
}
