# Contract: projects module

Schemas: `shared/src/schemas/projects.js`. State machine: `shared/src/machines/proposalMachine.js`.

## Proposals & projects

| Method | Path | authorize | Body / Query | Success | Notable errors |
|---|---|---|---|---|---|
| GET | `/projects` | `authorize('project.list','scope')` | `listProjectsQuery {academicYearId, collegeId, departmentId, status, supervisorId, field, type, q, page, limit, sort}` | paginated cards `{id, title, status, progress, statusFlag, college, department, supervisor, cover}` | — |
| POST | `/projects` | `authorize('proposal.create','self')` | `createProposalSchema {title, idea, problem, objectives[], scope, field, type, beneficiaries, keywords[], expectedOutcomes, cover?, preferredSupervisorId?}` | 201 project (`status: draft`; caller = leader) | `WINDOW_CLOSED` (US2-8), `BUSINESS_RULE: ALREADY_IN_ACTIVE_PROJECT` |
| GET | `/projects/similar-titles?title=…&excludeId=…` | `authorize('proposal.create','self')` | — | `[{id, title, score}]` ≤5 (warning only, FR-032) | — |
| GET | `/projects/:id` | `authorize('project.read','project')` | — | overview: team, supervision, status, progress, recent activity (FR-040) | `NOT_FOUND` (out of scope) |
| GET | `/projects/:id/summary` | `authorize('project.readSummary','project')` | — | read-only summary for partner-college admins (FR-034): `{id, title, status, college, department, academicYearLabel, leaderName, partnerMembers[], supervisorName, progress.percent, statusFlag}` — excludes deliverables, timeline, BOM, chat, defense minutes, audit logs | — |
| PATCH | `/projects/:id` | `authorize('proposal.update','project')` | `updateProposalSchema` (partial) | updated; new `proposalVersion` if previously submitted | `INVALID_TRANSITION` (not draft/needs_changes) |
| POST | `/projects/:id/transitions` | `authorize('proposal.transition','project')` + machine role check | `transitionSchema {event: SUBMIT|START_REVIEW|REQUEST_CHANGES|RESUBMIT|RECOMMEND|APPROVE|REJECT|RETURN|WITHDRAW, comment?}` | 200 project with new status + history entry | `INVALID_TRANSITION`, `BUSINESS_RULE: TEAM_BELOW_MIN`, `WINDOW_CLOSED`; `comment` required for REQUEST_CHANGES/REJECT/RECOMMEND |
| GET | `/projects/:id/history` | `authorize('project.read','project')` | — | status history + proposal versions | — |
| GET | `/projects/:id/versions/:version` | `authorize('project.read','project')` | — | proposal snapshot | — |

## Team

| Method | Path | authorize | Body | Success | Notable errors |
|---|---|---|---|---|---|
| POST | `/projects/:id/team/invitations` | `authorize('team.invite','project')` (leader) | `{inviteeId}` or `{link:true}` | 201 invitation (`url` when link) | `BUSINESS_RULE: TEAM_FULL` (US2-3), `CROSS_COLLEGE_NOT_ALLOWED`, `INVITEE_IN_ACTIVE_PROJECT` |
| GET | `/me/team-invitations` | `authorize('self.read','user')` | — | pending invitations | — |
| POST | `/team-invitations/:id/accept` | `authorize('team.respond','teamInvitation')` (invitee) | — | 200 | `TEAM_FULL`, `ALREADY_IN_ACTIVE_PROJECT` |
| POST | `/team-invitations/:id/decline` | `authorize('team.respond','teamInvitation')` | — | 200 | — |
| DELETE | `/projects/:id/team/members/:userId` | `authorize('team.removeMember','project')` | `{reason}` | 200 (before approval: leader; after: admin only, audited) | `BUSINESS_RULE: LOCKED_AFTER_APPROVAL` |
| POST | `/projects/:id/team/leave` | `authorize('team.leave','project')` | — | 200 (only before approval) | `LOCKED_AFTER_APPROVAL` |
| POST | `/projects/:id/team/move` | `authorize('team.moveMember','project')` (admin) | `{userId, targetProjectId, reason}` | 200 (audited) | — |
| POST | `/projects/:id/leadership-transfer` | `authorize('team.transferLeadership','project')` | `{toUserId}` | 201 pending transfer | — |
| POST | `/leadership-transfers/:id/accept` \| `/decline` | `authorize('team.respondTransfer','leadershipTransfer')` | — | 200; roles swap + history (US2-9) | — |

## Supervision

| Method | Path | authorize | Body / Query | Success | Notable errors |
|---|---|---|---|---|---|
| PUT | `/projects/:id/supervision` | `authorize('supervision.assign','project')` | `assignSupervisionSchema {primaryId?, coSupervisorIds[], mentorIds[], reviewerId?, overrideReason?}` | 200 (audited) | `BUSINESS_RULE: SUPERVISOR_AT_CAPACITY` (US2-6); `overrideReason` accepted only from College/University Admin |
| GET | `/supervisors/load` | `authorize('supervision.viewLoad','scope')` | `{academicYearId, collegeId?, departmentId?}` | `[{supervisorId, name, primaryCount, cap, coCount, remaining, isFull}]` | — |

## Ideas bank

| Method | Path | authorize | Body / Query | Success |
|---|---|---|---|---|
| GET | `/ideas` | `authorize('idea.list','scope')` | `{status, field, collegeId, ownerKind, page, limit}` | paginated |
| POST | `/ideas` | `authorize('idea.create','self')` (supervisor or approved investor) | `createIdeaSchema {title, description, field, type, collegeId?}` | 201 |
| PATCH | `/ideas/:id` | `authorize('idea.update','idea')` (owner) | partial | updated |
| POST | `/ideas/:id/remove` | `authorize('idea.remove','idea')` (in-scope admin) | `{reason}` | 200 (audited) |
| POST | `/ideas/:id/adoption-requests` | `authorize('idea.requestAdoption','idea')` (student) | `{projectId?}` | 201 |
| POST | `/adoption-requests/:id/accept` \| `/decline` | `authorize('idea.decideAdoption','adoptionRequest')` (owner) | — | 200; accept → prefilled proposal, idea `taken` (US2-7) |
