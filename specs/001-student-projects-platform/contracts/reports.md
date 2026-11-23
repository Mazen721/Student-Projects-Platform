# Contract: reports module

Schemas: `shared/src/schemas/reports.js`. All endpoints are aggregation pipelines whose first
`$match` stage is the caller's `scopeFilter` (Principle II, VIII). When `X-Role-Context` is set, `scopeFilter` restricts to that assignment; when omitted, it unions the caller's reporting assignments. Common query
`reportQuery {academicYearId?, yearLabel?, compareYearId?, compareYearLabel?, collegeId?, departmentId?, supervisorId?, field?, status?}` (one of `academicYearId` or `yearLabel` required; University-scope queries use `yearLabel`/`compareYearLabel` to aggregate across all colleges). Aggregate reports (`completion`, `supervisor-distribution`, `evaluation`, `insights`) support `compareYearId`/`compareYearLabel` returning `{ current, comparison? }`.
Every report endpoint supports `?format=json|xlsx|pdf`; `xlsx`/`pdf` render **the exact same result
object** as `json` (SC-010 parity) with Arabic RTL layout and `Content-Disposition: attachment; filename="report.<ext>"; filename*=UTF-8''<arabic-filename>`. Target: < 10 s for a full year.

| Method | Path | authorize | Returns (json) | Req |
|---|---|---|---|---|
| GET | `/reports/dashboard` | `authorize('report.dashboard','scope')` | KPI cards for active role + drill-down children `[{scopeType, id, name, status, kpis}]` | FR-120 |
| GET | `/reports/projects` | `authorize('report.projects','scope')` | paginated project rows (all statuses `draft`..`archived`) + status counts; `?format=xlsx|pdf` exports all filtered rows (cap 5,000 xlsx / 1,000 pdf) | FR-121 |
| GET | `/reports/completion` | `authorize('report.completion','scope')` | `{meanPercent, counts{on_track, at_risk, delayed}, shares{…}, perPhase[{name, meanPercent}], byChild[]}` (Approved + rolled-over `archived` projects attributed to leader's college; University `perPhase` groups by phase `order`) | FR-122, US7-1 |
| GET | `/reports/supervisor-distribution` | `authorize('report.supervisors','scope')` | `{supervisors[{id, name, status, primary, cap, co, remaining: max(0, cap-primary), overCap}], unassigned{count, projects[] (cap 100)}}` (deactivated supervisors' projects appear in `unassigned`) | FR-123, US7-2 |
| GET | `/reports/evaluation` | `authorize('report.evaluation','scope')` | per year over `{locked:true, isLatest:true}` per student: `{students, mean, min, max, passCount, failCount, passRate, bands{excellent, veryGood, good, acceptable, fail}, byChild[]}` (mixed college passMarks use stored `passed`/`band`); side-by-side when `compareYearId` | FR-124, US7-3 |
| GET | `/reports/insights` | `authorize('report.insights','scope')` | `{byField[] (top 25 + other), byTechnology[] (top 25 + other), budget{total, mean (over projectsWithBom>0), projectsWithBom}, late{count, percent (latest submission per submitted deliverable)}, engagement{validVotes, uniqueViews, follows, bookmarks, contactRequestsByStatus}}` | FR-125 |
| GET | `/reports/supervisor/me` | `authorize('report.supervisorSelf','self')` | `{primaryProjects[], coSupervisedProjects[], mentoredProjects[], summary}` grouped by supervision role with progress & flags | US7-5 |

Notes:
- Drill-down: the client re-queries with a narrower `collegeId`/`departmentId`; requesting a
  scope outside the caller's assignments returns `404 NOT_FOUND`. Historical deactivated colleges/departments/users remain visible with `status: 'deactivated'`.
- Heavy metrics may be served from `statscaches` (≤ 15 min old) with `computedAt` surfaced in JSON & UI; `?fresh=true` (admins) recomputes synchronously for both JSON and exports.
