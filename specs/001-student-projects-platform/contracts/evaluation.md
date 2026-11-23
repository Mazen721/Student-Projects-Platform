# Contract: evaluation module

Schemas: `shared/src/schemas/evaluation.js`. Calculators: `shared/src/calc/grading.js`,
`gradeBands.js`. State machine: `shared/src/machines/defenseMachine.js`.

## Rubrics

| Method | Path | authorize | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/colleges/:id/rubrics` | `authorize('rubric.list','college')` | `{academicYearId}` | list | — |
| POST | `/colleges/:id/rubrics` | `authorize('rubric.create','college')` | `rubricSchema {academicYearId, name, supervisorPct, committeePct, criteria[{key, name, weight, appliesTo: team|individual}]}` | 201 | `validation.weightsSum100`, `validation.splitSum100` |
| PATCH | `/rubrics/:id` | `authorize('rubric.update','rubric')` | partial | updated | `BUSINESS_RULE: RUBRIC_IN_USE` once scores exist |

## Eligibility, committees, scheduling

| Method | Path | authorize | Body / Query | Success | Errors |
|---|---|---|---|---|---|
| GET | `/projects/:id/defense/eligibility` | `authorize('defense.read','project')` | — | `{eligible, missingPhases[], signedOff}` | — |
| POST | `/projects/:id/defense/sign-off` | `authorize('defense.signOff','project')` (primary supervisor) | — | 200 → `eligible` | `NOT_ELIGIBLE_FOR_DEFENSE` (lists missing phases) |
| POST | `/projects/:id/defense` | `authorize('defense.schedule','project')` (dept/college admin) | `scheduleDefenseSchema {scheduledAt, durationMin, room?, meetingLink?, committee{chairId, memberIds[], externalExaminerIds[]}, acknowledgeConflicts?: bool}` | 201 defense; or 409 `CONFLICT` with `conflicts[]` until `acknowledgeConflicts:true` (US5-3) | `NOT_ELIGIBLE_FOR_DEFENSE` (US5-1), `BUSINESS_RULE: COI_VIOLATION` (US5-2) |
| PATCH | `/defenses/:id` | `authorize('defense.schedule','defense')` | reschedule / committee change | updated + notifications | same |
| GET | `/defenses` | `authorize('defense.list','scope')` | `{from, to, collegeId?, room?, examinerId?}` | calendar items (FR-084) | — |
| GET | `/defenses/:id` | `authorize('defense.read','defense')` | — | defense metadata + submission counts (`submittedCount/totalExaminers`), zero numeric scores before `finalized` (FR-085/FR-089a) | — |
| POST | `/invitations/external-examiner` | `authorize('defense.schedule','defense')` | `{defenseId, name}` | 201 `{url}` — role `committeeMember` scoped strictly to that `defenseId` (excluded from deliverables/chat/other defenses; expires upon defense `finalized`) | — |

## Grading

| Method | Path | authorize | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/defenses/:id/my-scoresheet` | `authorize('score.submit','defense')` (supervisor or committee examiner) | — | rubric + students + own latest version (others hidden until all submitted) | — |
| PUT | `/defenses/:id/my-scores` | `authorize('score.submit','defense')` | `scoresSchema {teamScores{criterionKey: n}, individualScores{studentId: {criterionKey: n}}, submit: bool}` | 200 draft or submitted (new version if previously submitted & unlocked) | `INVALID_TRANSITION` (not in grading/deliberation), `GRADE_LOCKED` |
| GET | `/defenses/:id/scores` | `authorize('score.viewAll','defense')` (chair; examiners after all submitted) | — | all examiner totals + `spread{studentId: n, exceeded}` | — |
| POST | `/defenses/:id/transitions` | `authorize('defense.transition','defense')` + machine roles | `{event: OPEN_GRADING|UNLOCK_FOR_REVISION|FINALIZE, note?}` | 200; `UNLOCK_FOR_REVISION` (≤3 rounds) unlocks all committee examiners for new score versions; `FINALIZE` (optimistic state guard) writes locked `grades` versions + audit (US5-5, US5-6) | `BUSINESS_RULE: SCORES_INCOMPLETE`, note required when spread exceeded |
| PUT | `/defenses/:id/minutes` | `authorize('defense.recordMinutes','defense')` (chair) | `{minutes, recommendations, modifications{required, description, deadline}}` | 200 (FR-088) | — |
| POST | `/defenses/:id/modifications/confirm` | `authorize('defense.confirmModifications','defense')` (supervisor) | — | 200 | — |

## Grades, re-evaluation, certificates

| Method | Path | authorize | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/projects/:id/grades` | `authorize('grade.read','project')` | — | staff: all students; student: **own only** with aggregated breakdown (FR-089a); partner-college admins: their student's final only | before finalization students get `NOT_FOUND`-free empty `{finalized:false}` |
| POST | `/projects/:id/reevaluations` | `authorize('reeval.request','project')` (student for self / supervisor project-wide) | `{studentId?, reason}` | 201 (≤1 per student, or ≤1 project-wide by supervisor; blocked if an active/completed project-wide request already covers the project) | `WINDOW_CLOSED`, `BUSINESS_RULE: REEVAL_ALREADY_REQUESTED` |
| GET | `/reevaluations` | `authorize('reeval.list','scope')` | `{status, page, limit}` | paginated | — |
| POST | `/reevaluations/:id/decide` | `authorize('reeval.decide','reevaluation')` (College Admin only) | `{decision: approve|reject, note, replacementCommittee?{chairId, memberIds[], externalExaminerIds[]}}` | 200 (audited); approve → defense `reevaluation_open` | — |
| GET | `/projects/:id/grades/:studentId/certificate.pdf` | `authorize('certificate.download','grade')` (that student, staff in scope) | — | `application/pdf` (`UTF-8` RFC 5987 `Content-Disposition`) Arabic result letter (available once `finalized`; shows modifications status note if pending) (FR-089, US5-8) | `NOT_FOUND` if not finalized |
