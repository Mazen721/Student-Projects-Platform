import { AUTHZ_SCOPES, ROLES } from '@spp/shared/constants';

const {
  UNIVERSITY_ADMIN,
  COLLEGE_ADMIN,
  DEPARTMENT_ADMIN,
  SUPERVISOR,
  COMMITTEE_MEMBER,
  STUDENT,
  INVESTOR,
  VISITOR,
} = ROLES;

const ALL_ROLES = Object.values(ROLES);
const STAFF_ADMINS = [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN];

export const POLICIES = Object.freeze({
  // Self & Account
  'self.read': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF, allowPending: true }],
  'self.update': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF }],
  'self.changePassword': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF, allowPending: true }],

  // Users & Roles
  'user.read': [
    { roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF },
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
  ],
  'user.list': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'user.searchForTeam': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, STUDENT], scope: AUTHZ_SCOPES.SELF }],
  'user.deactivate': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'user.reactivate': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'user.resetPassword': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'role.assign': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'role.revoke': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'invitation.create': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'invitation.revoke': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'investor.review': [{ roles: [UNIVERSITY_ADMIN], scope: AUTHZ_SCOPES.UNIVERSITY }],

  // Organization
  'university.read': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.UNIVERSITY, anyScope: true }],
  'university.update': [{ roles: [UNIVERSITY_ADMIN], scope: AUTHZ_SCOPES.UNIVERSITY }],
  'college.list': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.COLLEGE }],
  'college.create': [{ roles: [UNIVERSITY_ADMIN], scope: AUTHZ_SCOPES.UNIVERSITY }],
  'college.read': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR, STUDENT], scope: AUTHZ_SCOPES.COLLEGE }],
  'college.update': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'college.updateSettings': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'college.deactivate': [{ roles: [UNIVERSITY_ADMIN], scope: AUTHZ_SCOPES.UNIVERSITY }],
  'department.list': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR, STUDENT], scope: AUTHZ_SCOPES.COLLEGE }],
  'department.create': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'department.update': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'department.deactivate': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'academicYear.list': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR, STUDENT], scope: AUTHZ_SCOPES.COLLEGE }],
  'academicYear.create': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'academicYear.update': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'academicYear.rollover': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'import.run': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'audit.list': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'dashboard.home': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF, allowPending: true }],

  // Projects & Proposals
  'project.list': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR, STUDENT], scope: AUTHZ_SCOPES.DEPARTMENT }],
  'proposal.create': [{ roles: [STUDENT], scope: AUTHZ_SCOPES.SELF }],
  'project.read': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'project.readSummary': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { roles: [COLLEGE_ADMIN, DEPARTMENT_ADMIN], scope: AUTHZ_SCOPES.PARTNER },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'proposal.update': [{ relationship: 'leader' }],
  'proposal.transition': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'leader' },
    { relationship: 'anySupervisor' },
  ],
  'team.invite': [{ relationship: 'leader' }],
  'team.respond': [{ relationship: 'invitee' }],
  'team.removeMember': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'leader' },
  ],
  'team.leave': [{ relationship: 'teamMember' }],
  'team.moveMember': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'team.transferLeadership': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'leader' },
  ],
  'team.respondTransfer': [{ relationship: 'transferTarget' }],
  'supervision.assign': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'supervision.viewLoad': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'idea.list': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR, STUDENT, INVESTOR], scope: AUTHZ_SCOPES.SELF }],
  'idea.create': [{ roles: [SUPERVISOR, INVESTOR], scope: AUTHZ_SCOPES.SELF }],
  'idea.update': [{ relationship: 'owner' }],
  'idea.remove': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.COLLEGE }],
  'idea.requestAdoption': [{ roles: [STUDENT], scope: AUTHZ_SCOPES.SELF }],
  'idea.decideAdoption': [{ relationship: 'owner' }],

  // Tracking
  'phaseTemplate.list': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR], scope: AUTHZ_SCOPES.COLLEGE }],
  'phaseTemplate.create': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'phaseTemplate.update': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'phase.adjust': [{ relationship: 'primarySupervisor' }],
  'phase.markComplete': [{ relationship: 'primarySupervisor' }],
  'submission.create': [{ relationship: 'teamMember' }],
  'submission.review': [{ relationship: 'primarySupervisor' }],
  'project.setStatusFlag': [{ relationship: 'primarySupervisor' }],
  'task.list': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'task.create': [{ relationship: 'teamMember' }],
  'task.update': [{ relationship: 'teamMember' }],
  'task.delete': [{ relationship: 'teamMember' }],
  'bom.read': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'bom.write': [{ relationship: 'teamMember' }],
  'tools.read': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'tools.write': [{ relationship: 'teamMember' }],
  'meeting.read': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'meeting.write': [
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],

  // Collaboration
  'channel.list': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR, STUDENT], scope: AUTHZ_SCOPES.SELF }],
  'channel.createDirect': [
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'channel.read': [{ relationship: 'channelMember' }],
  'channel.write': [{ relationship: 'channelMember' }],
  'content.moderate': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'comment.read': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'comment.create': [
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'announcement.create': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR], scope: AUTHZ_SCOPES.DEPARTMENT }],
  'announcement.list': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF }],
  'notification.list': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF }],
  'notification.update': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF }],
  'media.read': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'media.write': [{ relationship: 'teamMember' }],

  // Evaluation
  'rubric.list': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR, COMMITTEE_MEMBER], scope: AUTHZ_SCOPES.COLLEGE }],
  'rubric.create': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'rubric.update': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'defense.list': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR, COMMITTEE_MEMBER], scope: AUTHZ_SCOPES.DEPARTMENT }],
  'defense.read': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { roles: [COMMITTEE_MEMBER], scope: AUTHZ_SCOPES.DEFENSE },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
    { relationship: 'committeeExaminer' },
  ],
  'defense.signOff': [{ relationship: 'primarySupervisor' }],
  'defense.schedule': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'score.submit': [
    { roles: [COMMITTEE_MEMBER], scope: AUTHZ_SCOPES.DEFENSE },
    { relationship: 'primarySupervisor' },
    { relationship: 'committeeExaminer' },
  ],
  'score.viewAll': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { roles: [COMMITTEE_MEMBER], scope: AUTHZ_SCOPES.DEFENSE },
    { relationship: 'committeeChair' },
    { relationship: 'committeeExaminer' },
    { relationship: 'primarySupervisor' },
  ],
  'defense.transition': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'committeeChair' },
    { relationship: 'primarySupervisor' },
  ],
  'defense.recordMinutes': [{ relationship: 'committeeChair' }],
  'defense.confirmModifications': [{ relationship: 'primarySupervisor' }],
  'grade.read': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { roles: [COLLEGE_ADMIN, DEPARTMENT_ADMIN], scope: AUTHZ_SCOPES.PARTNER },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'grade.readStudentFinal': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { roles: [COLLEGE_ADMIN, DEPARTMENT_ADMIN], scope: AUTHZ_SCOPES.PARTNER },
    { relationship: 'teamMember' },
  ],
  'reeval.request': [
    { relationship: 'teamMember' },
    { relationship: 'primarySupervisor' },
  ],
  'reeval.list': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'reeval.decide': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'certificate.download': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'selfGradeStudent' },
  ],

  // Showcase, Voting & Investors
  'showcase.edit': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'showcase.transition': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
  'showcase.feature': [{ roles: [UNIVERSITY_ADMIN], scope: AUTHZ_SCOPES.UNIVERSITY }],
  'vote.cast': [{ roles: [STUDENT, SUPERVISOR, COMMITTEE_MEMBER, INVESTOR, VISITOR, ...STAFF_ADMINS], scope: AUTHZ_SCOPES.SELF }],
  'vote.withdraw': [{ roles: [STUDENT, SUPERVISOR, COMMITTEE_MEMBER, INVESTOR, VISITOR, ...STAFF_ADMINS], scope: AUTHZ_SCOPES.SELF }],
  'vote.review': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'competition.create': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.COLLEGE }],
  'investor.follow': [{ roles: [INVESTOR], scope: AUTHZ_SCOPES.SELF }],
  'investor.bookmark': [{ roles: [INVESTOR], scope: AUTHZ_SCOPES.SELF }],
  'contact.request': [{ roles: [INVESTOR], scope: AUTHZ_SCOPES.SELF }],
  'contact.list': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
  ],
  'contact.decide': [{ relationship: 'leader' }],
  'challenge.list': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF }],
  'challenge.create': [{ roles: [INVESTOR], scope: AUTHZ_SCOPES.SELF }],
  'challenge.remove': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN], scope: AUTHZ_SCOPES.UNIVERSITY }],
  'publicComment.create': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF }],
  'publicComment.report': [{ roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF }],
  'publicComment.moderate': [
    { roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT },
    { relationship: 'teamMember' },
  ],

  // Reports
  'report.dashboard': [{ roles: [UNIVERSITY_ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPERVISOR], scope: AUTHZ_SCOPES.DEPARTMENT }],
  'report.projects': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'report.completion': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'report.supervisors': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'report.evaluation': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'report.insights': [{ roles: STAFF_ADMINS, scope: AUTHZ_SCOPES.DEPARTMENT }],
  'report.supervisorSelf': [{ roles: [SUPERVISOR], scope: AUTHZ_SCOPES.SELF }],

  // Uploads
  'upload.sign': [
    { roles: ALL_ROLES, scope: AUTHZ_SCOPES.SELF },
    { relationship: 'teamMember' },
    { relationship: 'anySupervisor' },
  ],
});
