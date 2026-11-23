# Contract: organization module

Schemas: `shared/src/schemas/organization.js`.

| Method | Path | authorize | Body / Query | Success | Notes |
|---|---|---|---|---|---|
| GET | `/university` | `authorize('university.read','university')` | — | university + settings | public subset via `/public/university` |
| PATCH | `/university/settings` | `authorize('university.update','university')` | `universitySettingsSchema {allowedEmailDomains[], minVoteAccountAgeHours, voteBurstPerIp10m}` | updated | audited |
| GET | `/colleges` | `authorize('college.list','scope')` | `{status, page, limit}` | paginated | public list via `/public/colleges` |
| POST | `/colleges` | `authorize('college.create','university')` | `createCollegeSchema {name, code}` | 201 | audited (US1-1) |
| GET | `/colleges/:id` | `authorize('college.read','college')` | — | college + settings | |
| PATCH | `/colleges/:id` | `authorize('college.update','college')` | `updateCollegeSchema` | updated | audited |
| PATCH | `/colleges/:id/settings` | `authorize('college.updateSettings','college')` | `collegeSettingsSchema {teamSizeMin, teamSizeMax, allowCrossCollege, supervisorPrimaryCap, passMark, gradeSpreadThreshold, reevaluationWindowDays}` | updated | audited |
| POST | `/colleges/:id/deactivate` | `authorize('college.deactivate','college')` | `{reason}` | 200 | no deletion (FR-010) |
| GET | `/colleges/:id/departments` | `authorize('department.list','college')` | page | paginated | |
| POST | `/colleges/:id/departments` | `authorize('department.create','college')` | `createDepartmentSchema {name, code}` | 201 | audited |
| PATCH | `/departments/:id` | `authorize('department.update','department')` | `updateDepartmentSchema` | updated | out-of-college → 404 (US1-2) |
| POST | `/departments/:id/deactivate` | `authorize('department.deactivate','department')` | `{reason}` | 200 | audited |
| GET | `/colleges/:id/academic-years` | `authorize('academicYear.list','college')` | — | list | |
| POST | `/colleges/:id/academic-years` | `authorize('academicYear.create','college')` | `academicYearSchema {label, startDate, endDate, semesters[], cycle{registrationOpensAt, registrationClosesAt, proposalDeadline, defenseStart, defenseEnd}}` | 201 | date-order refinements |
| PATCH | `/academic-years/:id` | `authorize('academicYear.update','academicYear')` | partial | updated | audited |
| POST | `/academic-years/:id/set-current` | `authorize('academicYear.update','academicYear')` | — | 200 | |
| POST | `/academic-years/:id/rollover` | `authorize('academicYear.rollover','academicYear')` | — | 200 `{archivedProjects}` | approved → archived, read-only (blocks edits/submissions/Kanban/BOM/chat/votes; permits read, re-evaluation `FR-087`, admin takedown/moderation, and reports) |
| GET | `/imports/template?kind=students|supervisors` | `authorize('import.run','college')` | — | `.xlsx` download | |
| POST | `/colleges/:id/imports` | `authorize('import.run','college')` | multipart `file` (.xlsx ≤5 MB), `kind` | 200 `{created, rejected[{row, field, code, message}], credentialsFile (base64 xlsx)}` | wrong headers → 400 `IMPORT_BAD_TEMPLATE` (FR-019, US1-8); `Cache-Control: no-store` |
| GET | `/audit-logs` | `authorize('audit.list','scope')` | `{action, actorId, targetType, targetId, from, to, page, limit}` | paginated (strict `scopeFilter`: College/Dept Admins see only entries matching their `scope.collegeId`/`departmentId`; University-level entries visible only to `universityAdmin`) | FR-004 |
| GET | `/dashboard/home` | `authorize('dashboard.home','self')` | `X-Role-Context` | role-specific summary | FR-022 |
