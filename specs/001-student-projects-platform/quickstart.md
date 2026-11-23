# Quickstart & Validation Guide: منصة مشاريع الطلاب

**Feature**: `001-student-projects-platform` | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/README.md](./contracts/README.md)

This guide covers local setup, environment configuration, automated verification commands, and
end-to-end validation scenarios proving the platform works across all 7 user stories.

---

## 1. Prerequisites

- **Node.js 22 LTS** (matches `.nvmrc`) and **npm ≥ 10** (workspaces support)
- **Git** (on branch `001-student-projects-platform`)
- **Playwright browsers** (installed once for E2E & a11y checks)
- **External accounts (staging/production only — local dev & tests run offline)**:
  - **MongoDB Atlas** (M0 free tier) with readWrite DB user and Atlas Search indexes from `server/src/core/search/atlasIndexes.json`
  - **Cloudinary** (free plan) with **Settings → Security → Allow delivery of PDF and ZIP files** enabled (see [research.md R-10](./research.md#r-10--cloudinary-signed-direct-uploads))
  - **Vercel** (client SPA) & **Railway** (always-on Express + Socket.IO server)

---

## 2. Environment Setup

Copy the example env files before running locally:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### `server/.env` (required variables)

| Variable | Local dev example | Notes |
|---|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017/spp_dev?replicaSet=rs0` (or Atlas M0 URI) | Replica set required for transactions |
| `JWT_SECRET` | `<32+ random bytes hex>` | Signs 15-min access JWTs |
| `JWT_REFRESH_SECRET` | `<32+ random bytes hex>` | Signs 7-day rotating refresh cookies |
| `CLOUDINARY_CLOUD_NAME` | `<cloud_name>` | Required for live uploads; mocked in tests |
| `CLOUDINARY_API_KEY` | `<api_key>` | |
| `CLOUDINARY_API_SECRET` | `<api_secret>` | Used for signed uploads & response verification |
| `CLIENT_URL` | `http://localhost:5173` | Exact CORS allow-list (comma-separated for multiple) |
| `SEARCH_PROVIDER` | `text` (local/CI) or `atlas` (Atlas M0) | See [research.md R-11](./research.md#r-11--arabic-search-and-similar-title-detection) |

### `client/.env`

| Variable | Local dev example | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000` | Base URL without `/api/v1` |

---

## 3. Install, Seed & Run Locally

```bash
# 1. Install all three workspaces (client, server, shared)
npm install

# 2. Bootstrap the university & initial University Admin (once on a fresh DB)
SEED_ADMIN_EMAIL=admin@mnu.edu.eg SEED_ADMIN_PASSWORD=ChangeMeNow!1 \
  npm --workspace server run seed:admin

# 3. (Optional) Seed demo data (2 colleges, departments, cycles, users, sample projects)
npm --workspace server run seed:demo

# 4. (Atlas M0 only) Sync Atlas Search indexes (projects_search, messages_search)
npm --workspace server run search:sync

# 5. Start server (:4000) + client (:5173) concurrently
npm run dev
```

**Verify boot**:
- `GET http://localhost:4000/api/health` returns `200 { "status": "ok", "db": "up" }`.
- Opening `http://localhost:5173` renders the Arabic RTL public showcase (`<html lang="ar" dir="rtl">`, Cairo font, navy/gold tokens from `DESIGN.md`).

---

## 4. Automated Test & Quality Gates

Run these commands to verify compliance with Constitution Principles I–IX:

```bash
# Lint (includes JSX no-literals Arabic-only rule, RTL logical-property rule, module-boundary rule)
npm run lint

# Shared unit tests (progress %, grading math, grade bands, trending, FSMs, Arabic normalizer, Zod schemas)
npm --workspace shared test

# Server unit + integration + contract + authorization matrix tests (MongoMemoryReplSet, no Atlas needed)
npm --workspace server test

# Client component, interceptor, form validation & RTL tests (Vitest + RTL + MSW)
npm --workspace client test

# End-to-end journeys + WCAG 2.1 AA (360×740 & 390×844) + English-text detector
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

**Expected outcomes**:
- `shared` tests verify 100% agreement with manual completion % and grading math (SC-007).
- `server/tests/authz` verifies every policy row in `server/src/core/authz/policies.js` has both a passing in-scope case and a denied out-of-scope case returning `404`/`403` (SC-004).
- `e2e/a11y` reports zero critical/serious axe violations at `360×740` and `390×844`, zero horizontal overflow, and zero non-allow-listed English UI strings (SC-011, SC-013).

---

## 5. End-to-End Validation Scenarios

Each scenario maps directly to the acceptance criteria in [spec.md](./spec.md) and the endpoints
in [contracts/](./contracts/README.md).

### Scenario A — Accounts, Roles, Scope Isolation & Bulk Import (P1)
1. Log in as University Admin, change the temporary password, create two colleges (`كلية الهندسة`, `كلية الحاسبات`) and departments under each, and configure an active academic year with open registration window ([contracts/organization.md](./contracts/organization.md)).
2. Generate single-use invite links for a College Admin (Engineering) and a Supervisor; accept both links and verify links reject reuse ([contracts/auth.md](./contracts/auth.md)).
3. As Engineering College Admin, attempt to `PATCH /api/v1/departments/:csDeptId` (Computers college) → expect `404 NOT_FOUND` with generic Arabic message and zero leakage.
4. Self-register a student with an allowed university email domain → expect immediate active session; retry with duplicate email/student ID → expect `409` naming the duplicate field in Arabic.
5. Self-register an investor → expect `status: "pending"` and `403 ACCOUNT_PENDING` on investor actions until approved by University Admin (audit log entry created).
6. Download the Excel template and upload a sheet with valid + invalid rows → expect valid accounts created with one-time credentials Excel and row-by-row Arabic error report.

### Scenario B — Proposal Workflow, Teams & Supervision Cap (P2)
1. As the student, query `/projects/similar-titles` while drafting a proposal → expect non-blocking warning list if similar titles exist; save as `draft`.
2. Invite teammates up to `teamSizeMax`; inviting one more returns `422 TEAM_FULL`.
3. Submit proposal (`POST /projects/:id/transitions` `{event: "SUBMIT"}`) → reviewing supervisor moves `START_REVIEW` → `REQUEST_CHANGES` (comment required) → leader edits (new `ProposalVersion` recorded) and `RESUBMIT`s → supervisor `RECOMMEND`s → Department Admin `APPROVE`s ([contracts/projects.md](./contracts/projects.md)).
4. Verify: project receives its own copy of the college's phase template, project group & team-only channels are created, and team members are locked for the academic year.
5. Attempt to assign a supervisor already at `supervisorPrimaryCap` as Department Admin → blocked (`422 SUPERVISOR_AT_CAPACITY`); retry as College Admin with `overrideReason` → succeeds and writes an `auditlogs` entry.

### Scenario C — Phases, Versioned Deliverables, Progress % & Tracking (P3)
1. Request a Cloudinary upload signature (`POST /uploads/sign`, [contracts/uploads.md](./contracts/uploads.md)), upload a PDF ≤ 10 MB directly, and attach it to a required deliverable (`version: 1`). Verify files > 10 MB or disallowed types are rejected with an Arabic message suggesting YouTube/Drive/GitHub links.
2. Upload a second file to the same deliverable → `version: 2` created while `version: 1` remains downloadable via signed URL. Submit past due date → `isLate: true`.
3. Supervisor approves 1 of 2 required deliverables in a 20%-weighted phase → `projects.progress.percent` updates immediately by `+10`.
4. Move Kanban tasks across columns, add BOM items (verify `budgetEstimate` updates automatically), log a meeting and convert an action item into a Kanban task ([contracts/tracking.md](./contracts/tracking.md)). Verify neither tasks nor milestones change `progress.percent`.

### Scenario D — Real-Time Chat, Privacy & Moderation (P4)
1. Connect two clients via Socket.IO with access JWTs ([contracts/socket-events.md](./contracts/socket-events.md)). Send a message in `project_group` with an `@mention` → recipient receives `message:new` within 2 s and an in-app `notification:new`.
2. Attempt `channel:join` on `team_only` as the supervisor → rejected (`NOT_FOUND`).
3. Admin removes a message via `POST /messages/:id/remove` → all connected clients receive `message:removed` and display the Arabic tombstone; action appears in `auditlogs`.
4. Upload a gallery photo (default `private`) and verify it does not appear in public showcase responses until toggled `public`.

### Scenario E — Defense, Blind Grading, Locking, Re-evaluation & PDF Certificate (P5)
1. Try scheduling defense before all required phases are approved / supervisor signs off → blocked (`422 NOT_ELIGIBLE_FOR_DEFENSE` listing missing phases).
2. Sign off, attempt forming a committee with the supervisor as chair or sole examiner → blocked (`422 COI_VIOLATION`). Schedule a valid committee; overlapping room/examiner returns `409 CONFLICT` warning until acknowledged ([contracts/evaluation.md](./contracts/evaluation.md)).
3. Examiner A submits scores; Examiner B fetches `my-scoresheet` and cannot see A's scores. Once all submit, verify spread > 15 flags the chair, who can either unlock for versioned revision or finalize with a mandatory note.
4. Chair calls `FINALIZE` (e.g. 40% supervisor 80 + 60% committee avg 80 → `80`). Verify subsequent score edits return `409 GRADE_LOCKED`.
5. Log in as a student → sees only own final grade, pass/fail, aggregated rubric breakdown, and recommendations (no individual examiner scores or teammates' individual grades). Download `certificate.pdf` → valid RTL Arabic PDF with Cairo font.
6. Submit one re-evaluation request within the configured window → College Admin approves → committee submits revised versioned scores and re-finalizes → `auditlogs` and `grades` preserve old and new values.

### Scenario F — Public Showcase, Anti-Fraud Voting & Investors (P6)
1. Request mini-site publication on an Approved project → stays private (`404` on `/public/projects/:slug`) until supervisor approves (`APPROVE`). Subsequent routine edits go live directly; admin takedown returns it to `404` and requires fresh approval ([contracts/showcase.md](./contracts/showcase.md)).
2. Inspect `/public/projects/:slug` while logged out → contains only allow-listed showcase fields; zero grades, deliverables, BOM prices/budgets, private photos, or un-opted-in student contacts.
3. Vote as a visitor account younger than `minVoteAccountAgeHours` → `422 VOTE_ACCOUNT_TOO_NEW` with availability timestamp. Vote as an eligible account → succeeds (`voteCount + 1`); second vote → `409 ALREADY_VOTED`. Self-vote by a team member/supervisor → `422 SELF_VOTE`. Burst votes beyond IP threshold → stored `flagged` and excluded from `validVotes`.
4. Approved investor sends a contact request → only the Team Leader can accept and explicitly choose shared contact details; investor sees only what was shared in the reply.

### Scenario G — Scoped Dashboards, Reports & Exports (P7)
1. Open `/reports/completion`, `/reports/supervisor-distribution`, `/reports/evaluation` (with `compareYearId`), and `/reports/insights` as a College Admin ([contracts/reports.md](./contracts/reports.md)) → verify only own-college data appears and attempting to pass another college's ID returns `404`.
2. Export each report with `?format=xlsx` and `?format=pdf` → verify RTL Arabic layout and 100% numeric parity with the JSON/on-screen view, completing in under 10 seconds.

---

## 6. Deployment Verification Checklist

- **Vercel (`client`)**: Root directory `client`; `vercel.json` rewrites `/(.*)` → `/index.html`; `VITE_API_URL` points to the Railway API domain; direct navigation to `/p/<slug>` returns HTTP 200.
- **Railway (`server`)**: Start command `npm --workspace server start`; `/api/health` green; all 7 required env vars set; `CLIENT_URL` matches exact Vercel origin (or shared custom university domain for first-party refresh cookies — see [research.md R-05](./research.md#r-05--authentication-tokens-and-cross-site-cookies)).
- **MongoDB Atlas**: M0 indexes built (unique `votes {projectId, userId}`, partial unique `users`, TTL indexes) and Atlas Search indexes (`projects_search`, `messages_search`) status `READY`.
