export const ORG_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DEACTIVATED: 'deactivated',
});
export const ORG_STATUS_VALUES = Object.freeze(Object.values(ORG_STATUSES));

export const ACADEMIC_YEAR_STATUSES = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});
export const ACADEMIC_YEAR_STATUS_VALUES = Object.freeze(Object.values(ACADEMIC_YEAR_STATUSES));

export const PROPOSAL_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  NEEDS_CHANGES: 'needs_changes',
  SUPERVISOR_RECOMMENDED: 'supervisor_recommended',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  ARCHIVED: 'archived',
});
export const PROPOSAL_STATUS_VALUES = Object.freeze(Object.values(PROPOSAL_STATUSES));

export const PROJECT_TYPES = Object.freeze({
  SOFTWARE: 'software',
  HARDWARE: 'hardware',
  HYBRID: 'hybrid',
  RESEARCH: 'research',
  DESIGN: 'design',
});
export const PROJECT_TYPE_VALUES = Object.freeze(Object.values(PROJECT_TYPES));

export const PROJECT_FIELD_VALUES = Object.freeze([
  'ai',
  'software_engineering',
  'cybersecurity',
  'iot_embedded',
  'robotics',
  'renewable_energy',
  'civil_architecture',
  'biomedical',
  'business_fintech',
  'data_science',
  'other',
]);

export const STATUS_FLAGS = Object.freeze({
  ON_TRACK: 'on_track',
  AT_RISK: 'at_risk',
  DELAYED: 'delayed',
});
export const STATUS_FLAG_VALUES = Object.freeze(Object.values(STATUS_FLAGS));

export const TEAM_INVITATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
});
export const TEAM_INVITATION_STATUS_VALUES = Object.freeze(Object.values(TEAM_INVITATION_STATUSES));

export const TRANSFER_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
});
export const TRANSFER_STATUS_VALUES = Object.freeze(Object.values(TRANSFER_STATUSES));

export const IDEA_STATUSES = Object.freeze({
  OPEN: 'open',
  TAKEN: 'taken',
  REMOVED: 'removed',
});
export const IDEA_STATUS_VALUES = Object.freeze(Object.values(IDEA_STATUSES));

export const ADOPTION_REQUEST_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
});
export const ADOPTION_REQUEST_STATUS_VALUES = Object.freeze(Object.values(ADOPTION_REQUEST_STATUSES));

export const PHASE_TEMPLATE_STATUSES = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});
export const PHASE_TEMPLATE_STATUS_VALUES = Object.freeze(Object.values(PHASE_TEMPLATE_STATUSES));

export const DELIVERABLE_STATUSES = Object.freeze({
  NONE: 'none',
  SUBMITTED: 'submitted',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});
export const DELIVERABLE_STATUS_VALUES = Object.freeze(Object.values(DELIVERABLE_STATUSES));

export const SUBMISSION_DECISIONS = Object.freeze({
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected',
});
export const SUBMISSION_DECISION_VALUES = Object.freeze(Object.values(SUBMISSION_DECISIONS));

export const TASK_COLUMNS = Object.freeze({
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  DONE: 'done',
});
export const TASK_COLUMN_VALUES = Object.freeze(Object.values(TASK_COLUMNS));

export const BOM_STATUSES = Object.freeze({
  NEEDED: 'needed',
  ORDERED: 'ordered',
  RECEIVED: 'received',
});
export const BOM_STATUS_VALUES = Object.freeze(Object.values(BOM_STATUSES));

export const TOOL_CATEGORIES = Object.freeze({
  LANGUAGE: 'language',
  FRAMEWORK: 'framework',
  LIBRARY: 'library',
  SERVICE: 'service',
  OTHER: 'other',
});
export const TOOL_CATEGORY_VALUES = Object.freeze(Object.values(TOOL_CATEGORIES));

export const CHANNEL_KINDS = Object.freeze({
  PROJECT_GROUP: 'project_group',
  TEAM_ONLY: 'team_only',
  DIRECT: 'direct',
});
export const CHANNEL_KIND_VALUES = Object.freeze(Object.values(CHANNEL_KINDS));

export const MEDIA_KINDS = Object.freeze({
  PHOTO: 'photo',
  VIDEO_LINK: 'video_link',
});
export const MEDIA_KIND_VALUES = Object.freeze(Object.values(MEDIA_KINDS));

export const MEDIA_VISIBILITY = Object.freeze({
  PRIVATE: 'private',
  PUBLIC: 'public',
});
export const MEDIA_VISIBILITY_VALUES = Object.freeze(Object.values(MEDIA_VISIBILITY));

export const DEFENSE_STATES = Object.freeze({
  NOT_ELIGIBLE: 'not_eligible',
  ELIGIBLE: 'eligible',
  SCHEDULED: 'scheduled',
  GRADING: 'grading',
  DELIBERATION: 'deliberation',
  FINALIZED: 'finalized',
  REEVALUATION_REQUESTED: 'reevaluation_requested',
  REEVALUATION_OPEN: 'reevaluation_open',
});
export const DEFENSE_STATE_VALUES = Object.freeze(Object.values(DEFENSE_STATES));

export const MODIFICATION_STATES = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  OVERDUE: 'overdue',
});
export const MODIFICATION_STATE_VALUES = Object.freeze(Object.values(MODIFICATION_STATES));

export const RUBRIC_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  LOCKED: 'locked',
});
export const RUBRIC_STATUS_VALUES = Object.freeze(Object.values(RUBRIC_STATUSES));

export const RUBRIC_CRITERION_TARGETS = Object.freeze({
  TEAM: 'team',
  INDIVIDUAL: 'individual',
});
export const RUBRIC_CRITERION_TARGET_VALUES = Object.freeze(Object.values(RUBRIC_CRITERION_TARGETS));

export const REEVALUATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
});
export const REEVALUATION_STATUS_VALUES = Object.freeze(Object.values(REEVALUATION_STATUSES));

export const SHOWCASE_STATES = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
  TAKEN_DOWN: 'taken_down',
});
export const SHOWCASE_STATE_VALUES = Object.freeze(Object.values(SHOWCASE_STATES));

export const SHOWCASE_TEMPLATES = Object.freeze({
  CLASSIC: 'classic',
  MODERN: 'modern',
  MINIMAL: 'minimal',
});
export const SHOWCASE_TEMPLATE_VALUES = Object.freeze(Object.values(SHOWCASE_TEMPLATES));

export const SHOWCASE_THEMES = Object.freeze({
  NAVY_GOLD: 'navy_gold',
  DEEP_NAVY_SLATE: 'deep_navy_slate',
  WARM_IVORY_NAVY: 'warm_ivory_navy',
});
export const SHOWCASE_THEME_VALUES = Object.freeze(Object.values(SHOWCASE_THEMES));

export const VOTE_STATUSES = Object.freeze({
  VALID: 'valid',
  FLAGGED: 'flagged',
  CLEARED: 'cleared',
  REJECTED: 'rejected',
});
export const VOTE_STATUS_VALUES = Object.freeze(Object.values(VOTE_STATUSES));

export const COMPETITION_STATES = Object.freeze({
  SCHEDULED: 'scheduled',
  OPEN: 'open',
  CLOSED: 'closed',
});
export const COMPETITION_STATE_VALUES = Object.freeze(Object.values(COMPETITION_STATES));

export const VOTER_RESTRICTIONS = Object.freeze({
  ALL: 'all',
  UNIVERSITY_ONLY: 'university_only',
});
export const VOTER_RESTRICTION_VALUES = Object.freeze(Object.values(VOTER_RESTRICTIONS));

export const CONTACT_REQUEST_STATES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  WITHDRAWN: 'withdrawn',
});
export const CONTACT_REQUEST_STATE_VALUES = Object.freeze(Object.values(CONTACT_REQUEST_STATES));

export const CHALLENGE_STATUSES = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
  REMOVED: 'removed',
});
export const CHALLENGE_STATUS_VALUES = Object.freeze(Object.values(CHALLENGE_STATUSES));

export const PUBLIC_COMMENT_STATES = Object.freeze({
  VISIBLE: 'visible',
  HIDDEN: 'hidden',
  REMOVED: 'removed',
});
export const PUBLIC_COMMENT_STATE_VALUES = Object.freeze(Object.values(PUBLIC_COMMENT_STATES));
