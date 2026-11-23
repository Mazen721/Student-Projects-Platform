# Contract: tracking module

Schemas: `shared/src/schemas/tracking.js`. Calculator: `shared/src/calc/progress.js`.
All project-scoped routes are nested under `/projects/:id` and authorized against that project
(archived-year projects → write actions return `BUSINESS_RULE: PROJECT_ARCHIVED`).

## Phase templates (college)

| Method | Path | authorize | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/colleges/:id/phase-templates` | `authorize('phaseTemplate.list','college')` | — | list | — |
| POST | `/colleges/:id/phase-templates` | `authorize('phaseTemplate.create','college')` | `phaseTemplateSchema {name, phases[{key, name, order, weight, dueDate|dueOffsetDays, requiredDeliverables[], forms[FileRefInput]}]}` | 201 | `VALIDATION_ERROR: validation.weightsSum100` (US3-2) |
| PATCH | `/phase-templates/:id` | `authorize('phaseTemplate.update','phaseTemplate')` | partial | updated (existing project copies unchanged) | — |

## Project phases, deliverables, submissions

| Method | Path | authorize | Body / Query | Success | Errors |
|---|---|---|---|---|---|
| GET | `/projects/:id/phases` | `project.read` | — | phases + deliverables + forms + per-phase % | — |
| PATCH | `/projects/:id/phases/:phaseId` | `authorize('phase.adjust','project')` (supervisor) | `{dueDate?}` | updated (FR-051; phase weights & template required deliverables remain locked) | — |
| POST | `/projects/:id/phases/:phaseId/complete` | `authorize('phase.markComplete','project')` | — | 200; progress recomputed (FR-056 zero-deliverable rule) | — |
| POST | `/projects/:id/phases/:phaseId/reopen` | `authorize('phase.markComplete','project')` | `{reason}` | 200; revokes zero-deliverable completion & recomputes progress (FR-056) | — |
| POST | `/projects/:id/phases/:phaseId/milestones` | `authorize('phase.adjust','project')` | `{title, dueDate}` | 201 | — |
| POST | `/projects/:id/deliverables/:deliverableId/submissions` | `authorize('submission.create','project')` (team member) | `createSubmissionSchema {files[CloudinaryUploadResult], links[LinkRef], note}` | 201 `{version, isLate}` (US3-3, US3-4; supersedes prior unreviewed version) | `UPLOAD_INVALID`, `DELIVERABLE_ALREADY_APPROVED` |
| GET | `/projects/:id/deliverables/:deliverableId/submissions` | `project.read` | — | all versions with signed download URLs | — |
| POST | `/submissions/:id/review` | `authorize('submission.review','submission')` (supervisor) | `reviewSchema {decision: approved|changes_requested|rejected, comment?}` | 200 + `progress` (US3-5; also revokes prior approval with mandatory comment) | `DEFENSE_ALREADY_SCHEDULED` |
| PATCH | `/projects/:id/status-flag` | `authorize('project.setStatusFlag','project')` | `{statusFlag}` | 200 (FR-057) | — |
| GET | `/projects/:id/timeline` | `project.read` | `{page, limit, type?}` | paginated events (FR-059) | — |

## Kanban, BOM, tools, meetings

| Method | Path | authorize | Body | Success |
|---|---|---|---|---|
| GET | `/projects/:id/tasks` | `authorize('task.list','project')` | — | tasks grouped by column |
| POST | `/projects/:id/tasks` | `authorize('task.create','project')` | `taskSchema {title, description?, column, assigneeIds[], dueDate?}` | 201 |
| PATCH | `/tasks/:taskId` | `authorize('task.update','task')` | partial incl. `{column, order}` (move) | updated |
| DELETE | `/tasks/:taskId` | `authorize('task.delete','task')` | — | 204 (tasks are not academic records) |
| GET/POST | `/projects/:id/bom` | `authorize('bom.read'/'bom.write','project')` | `bomItemSchema {item, quantity, specs, unitPrice, supplier, status}` | list `{items, budgetEstimate}` / 201 (US3-7) |
| PATCH/DELETE | `/bom/:itemId` | `authorize('bom.write','bomItem')` | partial | updated `{budgetEstimate}` |
| GET/POST | `/projects/:id/tools` | `authorize('tools.read'/'tools.write','project')` | `toolItemSchema` | list / 201 |
| GET/POST | `/projects/:id/meetings` | `authorize('meeting.read'/'meeting.write','project')` | `meetingSchema {date, attendeeIds[], notes, actionItems[]}` | list / 201 |
| POST | `/meetings/:meetingId/action-items/:index/to-task` | `authorize('task.create','meeting')` | — | 201 task (FR-058) |
