---

description: "Actionable, dependency-ordered task list for منصة مشاريع الطلاب (Student Projects Platform)"
---

# Tasks: منصة مشاريع الطلاب (Student Projects Platform)

**Input**: Design documents from `specs/001-student-projects-platform/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/README.md), [quickstart.md](./quickstart.md), [DESIGN.md](../../DESIGN.md)

**Tests**: Test-first (Red → Green → Refactor) is MANDATORY per Constitution Principle V and user request for permissions/scope checks, state machines, completion % math, grading math/locking, and voting integrity, plus integration/authz tests per story and Playwright E2E/a11y suites.

**Organization**: Tasks are grouped into Setup (Phase 1), Foundational (Phase 2), User Stories in priority order P1 → P7 (Phases 3–9, each an independently deliverable increment with a checkpoint), and Polish, E2E & Deployment for Vercel and Railway (Phase 10).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in the same phase)
- **[Story]**: User story label (`[US1]`–`[US7]`, used ONLY in User Story phases)
- Every task cites exact file paths from `plan.md`

## Path Conventions

- **Monorepo root**: `package.json`, `eslint.config.js`, `playwright.config.js`, `railway.toml`, `e2e/`
- **Shared workspace**: `shared/src/` (`@spp/shared`)
- **Backend workspace**: `server/src/`, `server/tests/`
- **Frontend workspace**: `client/src/`, `client/vercel.json`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the MERN npm-workspaces monorepo (`client`, `server`, `shared`), Atlas/Cloudinary configs, Arabic RTL layout shell (`DESIGN.md`), single Arabic locale resource, shared Zod schemas, and lint/test runners.

- [X] T001 Create root npm-workspaces `package.json` (`["client", "server", "shared"]`), `.nvmrc` (Node 22), `.gitignore`, and workspace skeletons under `client/`, `server/`, `shared/`, and `e2e/`
- [X] T002 [P] Initialize `shared/package.json` (`@spp/shared` ESM `exports` map) and shared domain constants in `shared/src/constants/roles.js`, `shared/src/constants/scopes.js`, `shared/src/constants/statuses.js`, `shared/src/constants/fileTypes.js`, `shared/src/constants/limits.js`, and `shared/src/constants/gradeBands.js`
- [X] T003 [P] Initialize `server/package.json` (Express 4.21, Mongoose 8, Socket.IO 4, Zod, bcrypt, jsonwebtoken, cloudinary, node-cron, exceljs, pdfkit, bidi-js, multer, pino, Vitest, Supertest, mongodb-memory-server) and `server/.env.example`
- [X] T004 [P] Initialize `client/package.json` (React 18, Vite 6, React Router 6, Tailwind CSS 4, TanStack Query 5, Axios, Zustand 5, React Hook Form 7, Zod, socket.io-client, Recharts, dnd-kit, react-helmet-async, lucide-react, Vitest, RTL, MSW) and `client/.env.example`
- [X] T005 [P] Configure flat ESLint rules in `eslint.config.js` (Arabic-only `react/jsx-no-literals` + prop checks, RTL logical CSS rule, server cross-module `*.model.js` import boundary rule) and add root `dev`/`lint`/`test`/`test:e2e` scripts in `package.json`
- [X] T006 [P] Create the single Arabic text resource and `t(key, vars)` interpolation helper in `shared/src/locales/ar.js` and re-export it in `client/src/locales/ar.js`
- [X] T007 [P] Create Arabic normalization, title-similarity, and slug utilities in `shared/src/text/normalizeArabic.js`, `shared/src/text/similarity.js`, and `shared/src/text/slugify.js`
- [X] T008 [P] Create shared Zod validation schemas (using Arabic message keys) in `shared/src/schemas/common.js`, `shared/src/schemas/auth.js`, `shared/src/schemas/organization.js`, `shared/src/schemas/projects.js`, `shared/src/schemas/tracking.js`, `shared/src/schemas/collaboration.js`, `shared/src/schemas/evaluation.js`, `shared/src/schemas/showcase.js`, and `shared/src/schemas/reports.js`
- [X] T009 [P] Implement lightweight finite-state-machine helper `defineMachine` in `shared/src/machines/fsm.js`
- [X] T010 [P] Create Zod-validated server env loader, MongoDB Atlas Mongoose connection, Cloudinary v2 SDK config, and exact CORS allow-list in `server/src/config/env.js`, `server/src/config/db.js`, `server/src/config/cloudinary.js`, and `server/src/config/cors.js`
- [X] T011 [P] Configure client RTL HTML shell (`<html lang="ar" dir="rtl">`, Cairo Google Font `preconnect`) in `client/index.html` and Tailwind v4 `@theme` tokens from `DESIGN.md` in `client/src/index.css`
- [X] T012 [P] Implement Arabic `Intl` (`ar-EG`, `Africa/Cairo`) date, relative-time, number, percent, and EGP currency formatters in `client/src/lib/format.js`
- [X] T013 [P] Configure test runners in `shared/vitest.config.js`, `server/vitest.config.js` (with `MongoMemoryReplSet` harness in `server/tests/setup.js`), `client/vitest.config.js` (with RTL/MSW setup in `client/src/test/setup.js`), and `playwright.config.js`
- [X] T014 [P] Create Express app skeleton and HTTP server bootstrap with `/api/health` (MongoDB ping) in `server/src/app.js` and `server/src/index.js`
- [X] T015 [P] Create React entrypoint (`QueryClientProvider`, `HelmetProvider`, `RouterProvider`) and router scaffold in `client/src/main.jsx`, `client/src/lib/queryClient.js`, and `client/src/routes/router.jsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Mongoose models, JWT + rotating httpOnly cookie auth, **test-first** central `authorize(action, resource)` middleware, Arabic error handling, security/rate-limiting, Cloudinary signed uploads, search provider, Socket.IO base, export utilities, and client API/UI kit.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Foundational Tests (Write FIRST — Ensure They FAIL Before Implementation) ⚠️

- [ ] T016 [P] Write failing unit tests for central authorization `can(user, action, scope)` covering University > College > Department > Project > Self hierarchy, cross-college partner read-only rules, `X-Role-Context`, and out-of-scope denial in `server/tests/unit/authz.test.js`
- [ ] T017 [P] Write failing integration tests for JWT access tokens, rotating `httpOnly; Secure; SameSite=None` refresh cookies, CSRF `X-Requested-With` check, token-reuse family revocation, and `mustChangePassword` enforcement in `server/tests/integration/auth-tokens.test.js`
- [ ] T018 [P] Write failing unit tests for `normalizeArabic`, `slugify`, `similarity`, and core shared Zod schemas in `shared/src/__tests__/text-and-schemas.test.js`

### Foundational Implementation

- [ ] T019 [P] Implement centralized Arabic error handler (`AppError`, `errorCodes`, Zod/Mongo duplicate-key mapping via `@spp/shared/locales/ar`) and Zod validation middleware in `server/src/core/errors/AppError.js`, `server/src/core/errors/errorCodes.js`, `server/src/core/errors/errorHandler.js`, and `server/src/core/validation/validate.js`
- [ ] T020 [P] Implement pagination helper (`limit ≤ 100`, whitelisted sort) and Express security/rate-limiting middleware (`helmet`, `cors`, `cookie-parser`, `express-mongo-sanitize`, global/auth/vote/write/upload limiters) in `server/src/core/pagination.js` and `server/src/core/rateLimits.js`
- [ ] T021 [P] Create core `AuditLog` (append-only hooks), `Notification` (unique sparse `dedupeKey` + read TTL), `PendingUpload` (24h TTL), and `JobLock` Mongoose models in `server/src/core/audit/auditlog.model.js`, `server/src/core/notifications/notification.model.js`, `server/src/core/uploads/pendingUpload.model.js`, and `server/src/jobs/jobLock.model.js`
- [ ] T022 [P] Create foundational `User` (partial unique `email`/`studentId` with `emailReleased`, private-by-default `privacy`, embedded `roles[]`), `RefreshToken` (TTL), and `Invitation` (TTL) Mongoose models in `server/src/modules/auth/user.model.js`, `server/src/modules/auth/refreshToken.model.js`, and `server/src/modules/auth/invitation.model.js`
- [ ] T023 [P] Create foundational `University`, `College`, `Department`, and `AcademicYear` Mongoose models with indexes in `server/src/modules/organization/university.model.js`, `server/src/modules/organization/college.model.js`, `server/src/modules/organization/department.model.js`, and `server/src/modules/organization/academicYear.model.js`
- [ ] T024 Implement JWT access/refresh token utilities (bcrypt cost 12, SHA-256 refresh hashes, family rotation) and `authenticate` middleware (`tokenVersion` & `mustChangePassword` checks) in `server/src/core/auth/tokens.js` and `server/src/core/auth/authenticate.js`
- [ ] T025 Implement central authorization engine (`policies.js`, `can.js`, `scopeResolvers.js`, `scopeFilter.js`, `authorize(action, resource)`, `publicRoute()` marker, and boot-time unguarded-route check) in `server/src/core/authz/policies.js`, `can.js`, `scopeResolvers.js`, `scopeFilter.js`, and `authorize.js` (passes `T016`)
- [ ] T026 [P] Implement `audit.service.js` (sensitive-field redaction, append-only logging, scoped listing) and `notify.service.js` (persist + Socket.IO `user:{id}` push + unread count) in `server/src/core/audit/audit.service.js` and `server/src/core/notifications/notify.service.js`
- [ ] T027 [P] Implement Cloudinary signed direct upload issuer (`POST /api/v1/uploads/sign`), response-signature verifier (`verifyUpload`), and `authenticated` signed delivery URL helper in `server/src/core/uploads/cloudinarySign.js`, `server/src/core/uploads/verifyUpload.js`, and `server/src/core/uploads/upload.routes.js`
- [ ] T028 [P] Implement dual search provider (`atlas` `lucene.arabic` + `text` normalized fallback) and Atlas Search JSON index definitions (`projects_search`, `messages_search`) in `server/src/core/search/searchProvider.js` and `server/src/core/search/atlasIndexes.json`
- [ ] T029 [P] Implement Socket.IO base attached to Express HTTP server with JWT handshake verification, `user:{id}` auto-join, and central `can()` room-join authorization in `server/src/realtime/socket.js`
- [ ] T030 [P] Implement Arabic RTL export primitives for Excel (`exceljs`, `rightToLeft: true`, formula-injection escaping) and PDF (`pdfkit`, embedded `Cairo-Regular.ttf`/`Cairo-Bold.ttf`, `bidi-js` visual ordering & RTL table helper) in `server/src/core/export/excel.js` and `server/src/core/export/pdf.js`
- [ ] T031 Wire security middleware, `/api/v1/uploads`, boot-time authz audit check, and `errorHandler` into `server/src/app.js` and attach Socket.IO in `server/src/index.js` (passes `T017`)
- [ ] T032 [P] Implement client Axios instance (single-flight token refresh interceptor, `X-Role-Context`, `X-Requested-With`), direct Cloudinary uploader, and Socket.IO client manager in `client/src/lib/api.js`, `client/src/lib/cloudinaryUpload.js`, and `client/src/lib/socket.js`
- [ ] T033 [P] Implement Zustand `authStore` (in-memory access token, user, roles, active role) and `uiStore` (toasts, mobile drawer) in `client/src/stores/authStore.js` and `client/src/stores/uiStore.js`
- [ ] T034 [P] Build RTL-safe Tailwind shared UI kit (`Button`, `Field`, `Input`, `Select`, `Textarea`, `Card`, `Badge`, `Tabs`, `Modal`, `Drawer`, `ResponsiveTable`, `Pagination`, `Skeleton`, `EmptyState`, `ProgressBar`, `Toast`, `Avatar`, `FileUploader`) matching `DESIGN.md` in `client/src/components/ui/`
- [ ] T035 [P] Build RTL layouts (`AppLayout` with navy `TopNav` ≥ lg and 360px-safe bottom `Dock` < lg, `PublicLayout`, `AuthLayout`, plus university logo slot/fallback badge in `client/public/logo-placeholder.svg`) and route guards (`RequireAuth`, `RequireRole`) in `client/src/layouts/` and `client/src/routes/guards.jsx`
- [ ] T036 [P] Write client unit tests for Axios single-flight refresh queue and RTL UI components in `client/src/test/api-and-ui.test.jsx`

**Checkpoint**: Foundation ready — core models, auth, central `authorize()` middleware, error handling, Cloudinary signed uploads, Socket.IO base, and RTL UI kit pass tests; user story implementation can now begin.

---

## Phase 3: User Story 1 - Accounts, Roles & University Structure (Priority: P1) 🎯 MVP

**Goal**: Deliver university structure (colleges, departments, academic years & cycle windows), student/investor/visitor self-registration, single-use role invitations, admin password resets, impostor deactivation/identifier release, Excel bulk student/supervisor import, profile privacy, multi-role switching, scoped audit logs, and role home dashboards.

**Independent Test**: Create a university with two colleges and departments, configure a cycle, self-register a student, invite a supervisor, register and approve an investor, bulk-import students from Excel (with 3 invalid rows), verify cross-college edit denial (`404`), and verify each role sees only its own dashboard and in-scope data.

### Tests for User Story 1 (Write FIRST — Ensure They FAIL Before Implementation) ⚠️

- [ ] T037 [P] [US1] Write failing integration tests for `auth` endpoints (student domain sign-up, duplicate email/studentId errors, investor pending/approve/reject, visitor account, single-use 7-day invite link, admin temp-password reset, impostor deactivation + identifier release `FR-013a`, contact privacy defaults) in `server/tests/integration/auth.test.js`
- [ ] T038 [P] [US1] Write failing integration tests for `organization` endpoints (college/department CRUD & deactivation, cross-college edit denied `404`, academic years/cycles, Excel bulk import partial success + bad-template rejection, scoped audit logs) in `server/tests/integration/organization.test.js`
- [ ] T039 [P] [US1] Write failing authorization matrix tests (positive in-scope & negative out-of-scope) for all P1 policy rows in `server/tests/authz/p1-authz.test.js`

### Implementation for User Story 1

- [ ] T040 [US1] Implement `auth` service (student/investor/visitor registration, login/refresh/logout, change/reset password, profile & privacy updates, user search/list/deactivate/reactivate/releaseIdentifiers, role assign/revoke, single-use invitations, investor review) in `server/src/modules/auth/auth.service.js` and `server/src/modules/auth/index.js`
- [ ] T041 [US1] Implement `auth` controllers, validation bindings, and guarded routes (`/auth/*`, `/users/*`, `/invitations/*`, `/investors/*`) in `server/src/modules/auth/auth.controller.js`, `server/src/modules/auth/auth.validation.js`, and `server/src/modules/auth/auth.routes.js`
- [ ] T042 [US1] Implement `organization` service (university settings, colleges/departments CRUD & deactivation, academic years/semesters/cycles/rollover, role home dashboard summary, scoped audit log queries) in `server/src/modules/organization/organization.service.js` and `server/src/modules/organization/index.js`
- [ ] T043 [US1] Implement bulk Excel import service (downloadable template + `multer` memory upload ≤ 5 MB, header validation, row-level Zod checks, batched bcrypt creation, one-time credentials `.xlsx` + Arabic error report) in `server/src/modules/organization/import.service.js`
- [ ] T044 [US1] Implement `organization` controllers, validation bindings, and guarded routes (`/university/*`, `/colleges/*`, `/departments/*`, `/academic-years/*`, `/imports/*`, `/audit-logs`, `/dashboard/home`) in `server/src/modules/organization/organization.controller.js`, `server/src/modules/organization/organization.validation.js`, and `server/src/modules/organization/organization.routes.js`
- [ ] T045 [P] [US1] Create University + initial University Admin bootstrap script and multi-college demo seed script in `server/src/scripts/seed-admin.js` and `server/src/scripts/seed-demo.js`
- [ ] T046 [P] [US1] Build Arabic auth pages (login, student/investor/visitor registration, invite acceptance, forced password change, pending-investor notice) and TanStack Query hooks in `client/src/features/auth/`
- [ ] T047 [P] [US1] Build profile editor with per-field contact privacy toggles (`FR-020`) and multi-role dashboard switcher (`X-Role-Context`) in `client/src/features/auth/ProfilePage.jsx` and `client/src/components/RoleSwitcher.jsx`
- [ ] T048 [P] [US1] Build university structure management pages (colleges, departments, college settings, academic years & cycle windows) in `client/src/features/organization/CollegesPage.jsx`, `client/src/features/organization/DepartmentsPage.jsx`, and `client/src/features/organization/AcademicYearsPage.jsx`
- [ ] T049 [P] [US1] Build scoped user management, invite link generator, investor approval queue, Excel bulk-import wizard (with error report & credentials download), and audit log viewer in `client/src/features/organization/UsersAdminPage.jsx`, `client/src/features/organization/BulkImportPage.jsx`, and `client/src/features/organization/AuditLogsPage.jsx`
- [ ] T050 [US1] Build role-aware Home Dashboard shell (student work-first layout + admin/supervisor/investor/visitor summaries) and wire P1 routes in `client/src/features/organization/HomeDashboardPage.jsx` and `client/src/routes/router.jsx`

**Checkpoint**: User Story 1 (MVP) is fully functional and independently testable — all P1 auth, scope isolation, organization, and Excel import tests pass.

---

## Phase 4: User Story 2 - Project Registration, Teams & Supervisor Assignment (Priority: P2)

**Goal**: Enable students to draft proposals with similar-title warnings, form teams within college size/cross-college policies, run the two-step proposal workflow (supervisor review → Department/College Admin decision) with full version/transition history, manage supervisor assignments within primary capacity caps (with audited College Admin overrides), transfer leadership, and adopt ideas from the ideas bank.

**Independent Test**: As a student, create a proposal inside an open registration window, invite teammates up to max size, submit, receive "يحتاج تعديلات" from the supervisor, resubmit, receive supervisor recommendation and Department Admin approval, assign a supervisor respecting capacity caps, and verify history and role-filtered project lists.

### Tests for User Story 2 (Write FIRST — Ensure They FAIL Before Implementation) ⚠️

- [ ] T051 [P] [US2] Write failing unit tests for `proposalMachine` transitions, role permissions, guards, and pure `windows.js` cycle-window checks in `shared/src/__tests__/proposalMachine.test.js`
- [ ] T052 [P] [US2] Write failing integration & authz tests for proposal CRUD/window checks, similar-title warning, team min/max size, single-active-project lock, cross-college partner read-only summary, two-step approval, supervisor primary cap + College Admin override, leadership transfer, and ideas bank adoption in `server/tests/integration/projects.test.js` and `server/tests/authz/p2-authz.test.js`

### Implementation for User Story 2

- [ ] T053 [US2] Implement explicit `proposalMachine` state machine (`draft → submitted → under_review → needs_changes → supervisor_recommended → approved | rejected | withdrawn | archived`) in `shared/src/machines/proposalMachine.js` and pure registration/proposal window helpers in `shared/src/calc/windows.js` (passes `T051`)
- [ ] T054 [P] [US2] Create `Project`, `ProjectMembership` (single-active-project partial unique index), `ProposalVersion`, `TeamInvitation`, `LeadershipTransfer`, `SupervisorAssignment`, `Idea`, and `AdoptionRequest` Mongoose models with indexes in `server/src/modules/projects/`
- [ ] T055 [US2] Implement proposal CRUD, similar-title search (Atlas/text fallback), snapshot versioning, and transactional two-step workflow transitions in `server/src/modules/projects/proposal.service.js`
- [ ] T056 [US2] Implement team invitation (search + link), min/max size & cross-college rules, single-active-project lock, post-approval admin move/remove, leadership transfer, and `removeImpostorMemberships(userId, session)` hook (exported for `FR-013a` cascade from `auth.service.js`) in `server/src/modules/projects/team.service.js` and `server/src/modules/projects/index.js`
- [ ] T057 [US2] Implement supervisor assignment (primary cap check, co-supervisor/mentor exclusion, College Admin audited override, load report) and ideas bank adoption in `server/src/modules/projects/supervision.service.js`, `server/src/modules/projects/ideas.service.js`, and `server/src/modules/projects/index.js`
- [ ] T058 [US2] Implement `projects` controllers, validation bindings, guarded routes (`/projects/*`, `/team-invitations/*`, `/leadership-transfers/*`, `/supervisors/load`, `/ideas/*`, `/adoption-requests/*`), and register `project`/`idea` scope resolvers in `server/src/modules/projects/projects.routes.js` and `server/src/core/authz/scopeResolvers.js`
- [ ] T059 [P] [US2] Build proposal creation/edit form with live similar-title warning banner (`FR-032`), registration-window banner, and proposal version/status history viewer in `client/src/features/projects/ProposalFormPage.jsx` and `client/src/features/projects/ProposalHistoryPanel.jsx`
- [ ] T060 [P] [US2] Build team management panel (teammate search/invite link, accept/decline invitations, leadership transfer, team-size limit messages) in `client/src/features/projects/TeamManagementPanel.jsx`
- [ ] T061 [P] [US2] Build supervisor review queue, Department/College Admin final decision panel, and supervisor load & assignment screen (with mandatory override reason modal) in `client/src/features/projects/ProposalReviewPage.jsx` and `client/src/features/projects/SupervisorLoadPage.jsx`
- [ ] T062 [P] [US2] Build ideas bank listing, idea submission form, and team adoption request workflow in `client/src/features/projects/IdeasBankPage.jsx`
- [ ] T063 [US2] Build filterable Projects List and Project Overview page and wire P2 routes in `client/src/features/projects/ProjectsListPage.jsx`, `client/src/features/projects/ProjectOverviewPage.jsx`, and `client/src/routes/router.jsx`

**Checkpoint**: User Stories 1 and 2 work independently — full proposal, team, supervisor capacity, and ideas bank flows pass all unit, integration, and authz tests.

---

## Phase 5: User Story 3 - Phases, Deliverables, Components & Progress Tracking (Priority: P3)

**Goal**: Enable colleges to define 100%-weighted phase templates with downloadable forms, automatically copy phases on project approval, accept versioned deliverable submissions (Cloudinary signed uploads ≤ 10 MB + links) with late flags and supervisor reviews, compute completion % automatically via pure tested functions, manage an RTL Kanban board, BOM (auto-calculated budget), software/tools list, meetings, chronological timeline, and daily in-app deadline reminders.

**Independent Test**: Save a 100%-weighted college phase template (verifying non-100% is rejected), approve a project to copy phases, upload deliverable v1 and v2, approve 1 of 2 required deliverables in a 20% phase and verify completion % rises by 10 percentage points, test late flag, BOM budget total, Kanban drag/move, meeting-to-task conversion, timeline events, and 3d/1d/0d reminders.

### Tests for User Story 3 (Write FIRST — Ensure They FAIL Before Implementation) ⚠️

- [ ] T064 [P] [US3] Write failing unit tests for pure completion % (`computeProgress`: proportional required deliverables, zero-deliverable supervisor-complete phase, late-approved counts, milestones/Kanban excluded, revocation recalculation, exact 100% rounding) and BOM budget (`computeBudget`) in `shared/src/__tests__/progress-and-budget.test.js`
- [ ] T065 [P] [US3] Write failing integration & authz tests for phase templates (100% weight check, copy on approval), versioned submissions (v1/v2 retention, late flag, disallowed/oversized upload rejection), supervisor reviews + immediate progress update, Kanban, BOM/tools, meetings, timeline, and 3d/1d/0d reminder job in `server/tests/integration/tracking.test.js` and `server/tests/authz/p3-authz.test.js`

### Implementation for User Story 3

- [ ] T066 [P] [US3] Implement pure completion % and BOM budget calculators in `shared/src/calc/progress.js` and `shared/src/calc/budget.js` (passes `T064`)
- [ ] T067 [P] [US3] Create `PhaseTemplate`, `ProjectPhase`, `Deliverable`, `Submission`, `Task`, `BOMItem`, `ToolItem`, `Meeting`, and `TimelineEvent` Mongoose models (with denormalized `collegeId`/`academicYearId` indexes) in `server/src/modules/tracking/`
- [ ] T068 [US3] Implement phase template CRUD, approval-triggered phase-copy service, phase adjustments/milestones, versioned deliverable submission (with `verifyUpload`), and supervisor review with transactional `computeProgress` update in `server/src/modules/tracking/phases.service.js` and `server/src/modules/tracking/submissions.service.js`
- [ ] T069 [US3] Implement Kanban tasks, BOM & tools (updating `projects.budgetEstimate`), meetings (action-item → Kanban task), supervisor `statusFlag`, chronological timeline logger, and module exports in `server/src/modules/tracking/board-bom.service.js`, `server/src/modules/tracking/timeline.service.js`, and `server/src/modules/tracking/index.js`
- [ ] T070 [US3] Implement `tracking` controllers, validation bindings, guarded routes (`/colleges/:id/phase-templates`, `/projects/:id/{phases,deliverables,tasks,bom,tools,meetings,timeline,status-flag}`, `/submissions/:id/review`) in `server/src/modules/tracking/tracking.routes.js` and invoke phase-copy hook from `server/src/modules/projects/proposal.service.js`
- [ ] T071 [P] [US3] Implement idempotent daily deliverable deadline reminder cron job (3 days, 1 day, due date via `notifications.dedupeKey`) in `server/src/jobs/deadlineReminders.js`
- [ ] T072 [P] [US3] Build College Admin phase template manager (100% weight validation + downloadable forms uploader) in `client/src/features/tracking/PhaseTemplatesPage.jsx`
- [ ] T073 [P] [US3] Build Project Phases, Deliverable Version Upload/History (Cloudinary direct upload + GitHub/YouTube/Drive links + late badge), and Supervisor Review UI in `client/src/features/tracking/ProjectPhasesPage.jsx`
- [ ] T074 [P] [US3] Build RTL Kanban Board using `dnd-kit` (with keyboard & 360px mobile move controls) in `client/src/features/tracking/KanbanBoardPage.jsx`
- [ ] T075 [P] [US3] Build Hardware BOM (auto-calculated total budget), Software/Tools list, Meetings log (convert action item to task), and Project Timeline pages in `client/src/features/tracking/BomToolsPage.jsx`, `client/src/features/tracking/MeetingsPage.jsx`, and `client/src/features/tracking/ProjectTimelinePage.jsx`
- [ ] T076 [US3] Wire P3 tracking tabs and routes into `client/src/features/projects/ProjectOverviewPage.jsx` and `client/src/routes/router.jsx`

**Checkpoint**: User Stories 1–3 work independently — phase templates, versioned deliverables, automatic completion % math, Kanban, BOM, meetings, timeline, and deadline reminders pass all tests.

---

## Phase 6: User Story 4 - Communication, Chat & Media (Priority: P4)

**Goal**: Deliver real-time project group chat (team + supervisors), strictly isolated team-only chat (supervisors blocked), direct student–supervisor messages, attachments, `@mentions`, replies, read receipts, message search, deliverable/task comment threads, scoped announcements, in-app notification center, project media gallery with public/private albums, and audited admin content moderation.

**Independent Test**: Exchange messages across all three channel types via Socket.IO (< 2 s delivery), confirm supervisor access to `team_only` is denied (`NOT_FOUND`), send an `@mention` and verify an in-app notification, search channel messages, upload private/public album media, post a supervisor announcement, and remove a message as admin verifying tombstone replacement and audit log.

### Tests for User Story 4 (Write FIRST — Ensure They FAIL Before Implementation) ⚠️

- [ ] T077 [P] [US4] Write failing integration, Socket.IO (including p95 delivery `< 2 s` assertion for `SC-006`), and authz tests for `project_group` / `team_only` (supervisor denied) / `direct` channels, real-time `message:send`/`message:new`, `@mention` notifications, read receipts, message search, comment threads, announcements fan-out, admin moderation tombstone + audit, and private/public media visibility in `server/tests/integration/collaboration.test.js` and `server/tests/authz/p4-authz.test.js`

### Implementation for User Story 4

- [ ] T078 [P] [US4] Create `Channel`, `Message`, `Comment`, `Announcement`, `MediaAlbum`, and `MediaItem` Mongoose models with indexes in `server/src/modules/collaboration/`
- [ ] T079 [US4] Implement channel auto-provisioning (on approval), direct channels, message persistence/search/read-receipts/moderation, comment threads, announcements fan-out, notification center service, and media gallery service in `server/src/modules/collaboration/collaboration.service.js`, `server/src/modules/collaboration/media.service.js`, and `server/src/modules/collaboration/index.js`
- [ ] T080 [US4] Implement Socket.IO chat handlers (`channel:join/leave`, rate-limited `message:send`, `message:read`, throttled `typing:start/stop`, `message:removed` broadcast) in `server/src/realtime/chat.handlers.js` and wire into `server/src/realtime/socket.js`
- [ ] T081 [US4] Implement `collaboration` controllers, validation bindings, guarded routes (`/channels/*`, `/messages/:id/remove`, `/comments/*`, `/announcements/*`, `/notifications/*`, `/projects/:id/albums`, `/albums/:id/items`, `/media-items/:id`) in `server/src/modules/collaboration/collaboration.routes.js` and invoke channel provisioning from `server/src/modules/projects/proposal.service.js`
- [ ] T082 [P] [US4] Build RTL real-time Chat Panel (channel switcher hiding `team_only` from supervisors, navy/white bubbles, attachments, `@mention` picker, replies, read receipts, typing indicator, message search, admin moderation action) in `client/src/features/collaboration/ProjectChatPage.jsx`
- [ ] T083 [P] [US4] Build reusable Deliverable & Task Comment Thread component in `client/src/features/collaboration/CommentThread.jsx`
- [ ] T084 [P] [US4] Build In-App Notification Center (live Socket.IO unread badge, list, mark-read) and Scoped Announcements page in `client/src/features/collaboration/NotificationCenter.jsx` and `client/src/features/collaboration/AnnouncementsPage.jsx`
- [ ] T085 [P] [US4] Build Project Media Gallery (albums, Cloudinary photo upload, YouTube/Google Drive 16:9 embed, public/private visibility toggle defaulting private) in `client/src/features/collaboration/MediaGalleryPage.jsx`
- [ ] T086 [US4] Wire P4 chat, gallery, comment threads, and notification bell into `client/src/layouts/AppLayout.jsx`, `client/src/features/projects/ProjectOverviewPage.jsx`, and `client/src/routes/router.jsx`

**Checkpoint**: User Stories 1–4 work independently — real-time chat, channel isolation, comments, announcements, notifications, media albums, and moderation pass all tests.

---

## Phase 7: User Story 5 - Defense & Evaluation (Priority: P5)

**Goal**: Enable colleges to configure weighted Team/Individual rubrics (summing to 100%) and supervisor/committee splits, gate defense eligibility on approved phases + supervisor sign-off, form conflict-free committees (incl. external examiner invites), schedule defenses with room/examiner conflict warnings, collect blind independent examiner grades, detect spread (> threshold) with deliberation unlock or justified finalization, compute team and individual final grades via pure tested functions, lock finalized grades immutably, run the bounded audited College Admin re-evaluation flow, track post-defense modifications, and generate Arabic PDF result letters/certificates.

**Independent Test**: Configure a 40/60 rubric, verify unapproved project cannot be scheduled, sign off, reject a COI committee, schedule a valid committee, confirm blind grading hides peer scores until all submit, verify spread warning and final grade math (`0.4×80 + 0.6×avg(70,90) = 80`), confirm `GRADE_LOCKED` blocks edits, complete an audited College Admin re-evaluation, verify student privacy (`FR-089a`), and download the Arabic PDF certificate.

### Tests for User Story 5 (Write FIRST — Ensure They FAIL Before Implementation) ⚠️

- [ ] T087 [P] [US5] Write failing unit tests for `defenseMachine` and pure grading calculators (`computeEvaluatorTotal`, `computeStudentFinal`, `computeTeamGrade`, `spreadExceeded` default 15, `gradeBand` Arabic bands & `passMark`) in `shared/src/__tests__/grading-and-defense.test.js`
- [ ] T088 [P] [US5] Write failing integration & authz tests for rubric validation, defense eligibility gate, COI rejection, room/examiner conflict warning, blind grading, spread deliberation unlock, chair finalization + immutable `GRADE_LOCKED` model hook, student grade privacy (`FR-089a`), bounded College Admin re-evaluation + audit trail, post-defense modifications overdue job, and Arabic PDF certificate generation in `server/tests/integration/evaluation.test.js` and `server/tests/authz/p5-authz.test.js`

### Implementation for User Story 5

- [ ] T089 [P] [US5] Implement `defenseMachine` state machine and pure grading/grade-band calculators in `shared/src/machines/defenseMachine.js`, `shared/src/calc/grading.js`, and `shared/src/calc/gradeBands.js` (passes `T087`)
- [ ] T090 [P] [US5] Create `Rubric`, `Committee`, `Defense`, `ExaminerScore` (versioned), `Grade` (with locked immutability pre-update/save hook), and `ReEvaluationRequest` Mongoose models with indexes in `server/src/modules/evaluation/`
- [ ] T091 [US5] Implement rubric CRUD, eligibility check & supervisor sign-off, committee formation (COI rules + external examiner single-use invite), and conflict-checked defense scheduling in `server/src/modules/evaluation/defense.service.js`
- [ ] T092 [US5] Implement blind examiner score submission, spread detection & deliberation unlock, transactional chair finalization (writing locked `Grade` versions + audit), bounded re-evaluation request/approval/re-finalization, and post-defense modifications confirmation in `server/src/modules/evaluation/grading.service.js` and `server/src/modules/evaluation/index.js`
- [ ] T093 [US5] Implement printable Arabic PDF result letter / certificate service (embedded Cairo font, bidi shaping, university/college branding, student own final grade, pass/fail, and aggregated rubric breakdown) in `server/src/modules/evaluation/certificate.service.js`
- [ ] T094 [US5] Implement `evaluation` controllers, validation bindings, guarded routes (`/colleges/:id/rubrics`, `/projects/:id/defense/*`, `/defenses/*`, `/projects/:id/grades/*`, `/reevaluations/*`), and overdue-modifications cron job in `server/src/modules/evaluation/evaluation.routes.js` and `server/src/jobs/modificationsOverdue.js`
- [ ] T095 [P] [US5] Build College Admin rubric configurator (Team/Individual criteria weights = 100%, supervisor/committee split = 100%, passMark/spread/re-eval settings) in `client/src/features/evaluation/RubricsPage.jsx`
- [ ] T096 [P] [US5] Build Defense Eligibility, Committee Builder (COI feedback + external examiner invite), and Defense Calendar/Scheduler (room/examiner conflict warning) pages in `client/src/features/evaluation/DefenseSchedulingPage.jsx`
- [ ] T097 [P] [US5] Build Examiner Blind Scoresheet, Chair Deliberation/Spread Warning/Finalization, and Defense Minutes & Modifications workspace in `client/src/features/evaluation/GradingWorkspacePage.jsx`
- [ ] T098 [US5] Build Student Grade & Arabic PDF Certificate page (`FR-089a`), Re-Evaluation Request & College Admin Decision queue, and wire P5 routes in `client/src/features/evaluation/StudentGradePage.jsx`, `client/src/features/evaluation/ReEvaluationQueuePage.jsx`, and `client/src/routes/router.jsx`

**Checkpoint**: User Stories 1–5 work independently — rubrics, defense scheduling, blind grading, exact grade math, immutable grade locking, audited re-evaluation, and Arabic PDF certificates pass all tests.

---

## Phase 8: User Story 6 - Public Showcase (Mini-site per Project), Voting & Investors (Priority: P6)

**Goal**: Deliver a customizable public mini-site (`/p/:slug`) per approved project with ≥3 templates, first-publish supervisor approval, direct routine edits, audited takedown re-approval, strict allow-list public projections (zero private/grade/BOM-price/contact leakage), public home & college showcases, anti-fraud single-vote protection (unique `{projectId, userId}`, min account age, self-vote block, IP burst flagging), time-limited competitions with frozen rankings, approved investor follow/bookmark/challenges/leader-only contact requests, and moderated public comments.

**Independent Test**: Build and request publication of a mini-site, approve as supervisor, view `/p/:slug` while logged out confirming private contacts/BOM prices/grades are absent, verify young-account vote rejection, cast a valid vote, confirm duplicate vote rejection and self-vote block, trigger and clear a burst-flagged vote, accept an investor contact request as Team Leader sharing only selected details, unpublish confirming "هذا المشروع غير متاح حالياً", and verify closed-competition voting is blocked.

### Tests for User Story 6 (Write FIRST — Ensure They FAIL Before Implementation) ⚠️

- [ ] T099 [P] [US6] Write failing unit tests for `showcaseMachine`, `contactRequestMachine`, `voteEligibility` (active account, min account age 24h, self-vote block for team/supervisors, competition open & university-only restriction), and `computeTrending` (`votes7d × 3 + views7d`) in `shared/src/__tests__/voting-and-showcase.test.js`
- [ ] T100 [P] [US6] Write failing integration & authz tests for first-publish supervisor approval, routine live edits, takedown re-approval, public allow-list projection (zero private leakage), unique `{projectId, userId}` vote enforcement, IP burst flagging & admin clearing, impostor deactivation vote invalidation (`FR-013a`), competition freezing, investor follow/bookmark/leader-only contact reply, challenges, and public comment moderation in `server/tests/integration/showcase.test.js` and `server/tests/authz/p6-authz.test.js`

### Implementation for User Story 6

- [ ] T101 [P] [US6] Implement `showcaseMachine`, `contactRequestMachine`, pure `voteEligibility`, and `computeTrending` in `shared/src/machines/showcaseMachine.js`, `shared/src/machines/contactRequestMachine.js`, `shared/src/calc/voteEligibility.js`, and `shared/src/calc/trending.js` (passes `T099`)
- [ ] T102 [P] [US6] Create `ShowcasePage`, `Vote` (unique compound `{projectId: 1, userId: 1}`), `Competition`, `CompetitionVote`, `PageView` (TTL 35d), `VoteIpCounter` (TTL 1h), `Follow`, `Bookmark`, `ContactRequest`, `Challenge`, and `PublicComment` Mongoose models in `server/src/modules/showcase/`
- [ ] T103 [US6] Implement mini-site CRUD, publish/approval/takedown transitions, strict public allow-list projector (per-student contact opt-in + public-only gallery), public home/college/search listings, and daily deduped page-view beacon in `server/src/modules/showcase/showcase.service.js`
- [ ] T104 [US6] Implement transactional voting & competition service (unique vote + `$inc validVotes`, IP burst flagging, admin flagged-vote review, `invalidateImpostorVotes(userId, session)` hook for `FR-013a` cascade, competition creation & lazy/scheduled ranking freeze on `endsAt`) and hourly trending cron job in `server/src/modules/showcase/voting.service.js`, `server/src/modules/showcase/index.js`, and `server/src/jobs/trending.js`
- [ ] T105 [US6] Implement investor interactions (follow, bookmark, leader-only contact-request reply sharing explicit fields only, direct challenges) and public comment moderation service in `server/src/modules/showcase/investor.service.js`, `server/src/modules/showcase/comments.service.js`, and `server/src/modules/showcase/index.js`
- [ ] T106 [US6] Implement `showcase` controllers, validation bindings, and public + guarded routes (`/public/*`, `/projects/:id/{showcase,vote,follow,bookmark,contact-requests,public-comments}`, `/competitions/*`, `/votes/*`, `/challenges/*`, `/university/featured`) in `server/src/modules/showcase/showcase.routes.js`
- [ ] T107 [P] [US6] Build Public Showcase Home (featured, trending, most-voted, Arabic search & filters) and Per-College Showcase page in `client/src/features/showcase/PublicHomePage.jsx` and `client/src/features/showcase/CollegeShowcasePage.jsx`
- [ ] T108 [P] [US6] Build Public Project Mini-Site (`/p/:slug`) supporting ≥3 templates, approved themes, public gallery, 16:9 video embed, vote action (login/age prompts), public comments, and unavailable notice in `client/src/features/showcase/ProjectMiniSitePage.jsx`
- [ ] T109 [P] [US6] Build Team Mini-Site Builder (section editor, template/theme picker, show/hide toggles, preview, publish/unpublish) and Supervisor Approval / Admin Takedown controls in `client/src/features/showcase/MiniSiteBuilderPage.jsx`
- [ ] T110 [P] [US6] Build Competitions & Rankings pages, Admin Flagged-Votes review queue, and Investor Workspace (follows, bookmarks, challenges, contact requests & leader-only reply dialog) in `client/src/features/showcase/CompetitionsPage.jsx`, `client/src/features/showcase/FlaggedVotesPage.jsx`, and `client/src/features/showcase/InvestorWorkspacePage.jsx`
- [ ] T111 [US6] Wire P6 code-split public and authenticated routes into `client/src/routes/router.jsx`

**Checkpoint**: User Stories 1–6 work independently — public mini-sites, privacy projections, anti-fraud voting, competitions, investor flows, and comment moderation pass all tests.

---

## Phase 9: User Story 7 - Dashboards & Reports (Priority: P7)

**Goal**: Deliver scoped drill-down dashboards (`University > College > Department > Project`), the four required reports (project reports, completion rates, supervisor distribution, per-student evaluation statistics with Arabic grade bands & YoY comparison) plus insights (`FR-125`), backed exclusively by indexed MongoDB aggregation pipelines and cached stats, with interactive RTL `Recharts` visualizations and Arabic RTL PDF & Excel exports matching on-screen figures (`SC-010`).

**Independent Test**: With seeded data across two colleges and two academic years, open every report as a College Admin confirming strict own-college isolation, drill down to a project, compare two years side-by-side, verify Supervisor Dashboard shows only supervised/co-supervised projects, and export each report to Arabic RTL Excel and PDF verifying exact numeric parity in under 10 seconds.

### Tests for User Story 7 (Write FIRST — Ensure They FAIL Before Implementation) ⚠️

- [ ] T112 [P] [US7] Write failing integration, zero-`COLLSCAN` explain, scope-isolation, and export-parity tests for `/reports/{dashboard,projects,completion,supervisor-distribution,evaluation,insights,supervisor/me}` (including `?format=xlsx` and `?format=pdf` parity and YoY comparison) in `server/tests/integration/reports.test.js` and `server/tests/authz/p7-authz.test.js`

### Implementation for User Story 7

- [ ] T113 [P] [US7] Create `StatsCache` Mongoose model with unique `{kind, yearKey, scopeType, scopeId}` index (supporting `academicYearLabel` at University scope) and `recalcStats` + nightly `cleanup` cron jobs in `server/src/modules/reports/statsCache.model.js`, `server/src/jobs/recalcStats.js`, and `server/src/jobs/cleanup.js`
- [ ] T114 [US7] Implement MongoDB aggregation pipelines (`$match` `scopeFilter` first; `yearLabel`/`compareYearLabel` for cross-college University queries and `academicYearId` for college/department queries) for dashboard drill-down, project reports, completion rates, supervisor distribution, per-student evaluation statistics (Arabic bands + YoY), insights (`FR-125`), and supervisor personal metrics in `server/src/modules/reports/reports.service.js` and `server/src/modules/reports/index.js`
- [ ] T115 [US7] Implement Arabic RTL Excel (`exceljs`) and PDF (`pdfkit`) report exporters rendering the identical pipeline result object with UTF-8 RFC 5987 `Content-Disposition` Arabic filenames in `server/src/modules/reports/reports.export.js`
- [ ] T116 [US7] Implement `reports` controllers, validation bindings, and guarded routes (`/reports/*`) in `server/src/modules/reports/reports.controller.js` and `server/src/modules/reports/reports.routes.js`
- [ ] T117 [P] [US7] Build reusable RTL `Recharts` chart components (bar, stacked-bar, donut, YoY grouped bar with `ar-EG` labels/tooltips + accessible table fallback) in `client/src/components/charts/`
- [ ] T118 [P] [US7] Build Scoped Analytics Dashboard (`University > College > Department > Project` drill-down) and Supervisor Personal Dashboard (`US7-5`) in `client/src/features/reports/AnalyticsDashboardPage.jsx` and `client/src/features/reports/SupervisorDashboardPage.jsx`
- [ ] T119 [P] [US7] Build Project Reports, Completion Rates, and Supervisor Distribution pages with filters and Arabic PDF/Excel export buttons in `client/src/features/reports/ProjectReportsPage.jsx`, `client/src/features/reports/CompletionReportPage.jsx`, and `client/src/features/reports/SupervisorDistributionPage.jsx`
- [ ] T120 [P] [US7] Build Evaluation Statistics (Arabic grade bands + YoY comparison) and Insights (fields, technologies, BOM budgets, late submissions, showcase engagement) report pages in `client/src/features/reports/EvaluationReportPage.jsx` and `client/src/features/reports/InsightsReportPage.jsx`
- [ ] T121 [US7] Wire P7 report routes and role navigation links into `client/src/routes/router.jsx` and `client/src/layouts/AppLayout.jsx`

**Checkpoint**: All 7 user stories (P1–P7) are complete and independently verified with exact on-screen/export parity and strict scope isolation.

---

## Phase 10: Polish, E2E Verification & Deployment (Vercel + Railway)

**Purpose**: Wire scheduled jobs and Atlas Search indexes, execute full authorization-matrix, E2E, WCAG 2.1 AA (`360×740` / `390×844`), and zero-English audits, and configure production deployment for Vercel (client) and Railway (server).

- [ ] T122 [P] Wire central `node-cron` scheduler (`recalcStats`, `trending`, `deadlineReminders`, `modificationsOverdue`, `cleanup` with `JobLock` and `Africa/Cairo` timezone) in `server/src/jobs/scheduler.js` and start from `server/src/index.js`
- [ ] T123 [P] Implement Atlas Search index sync script (`projects_search`, `messages_search` with `lucene.arabic`) and University Admin Atlas M0 storage-usage readout in `server/src/scripts/sync-search-indexes.js` and `server/src/modules/reports/reports.service.js`
- [ ] T124 [P] Create automated full authorization matrix test walking every row of `server/src/core/authz/policies.js` (in-scope pass + out-of-scope deny, proving `SC-004` = 100%) in `server/tests/authz/full-matrix.test.js`
- [ ] T125 [P] Write Playwright end-to-end critical-journey test (student sign-up → proposal → two-step approval → deliverable v1/v2 & progress % → defense & blind grading → finalization & PDF certificate → mini-site publish → eligible voting & duplicate block → scoped report export) in `e2e/journeys/full-lifecycle.spec.js`
- [ ] T126 [P] Write Playwright WCAG 2.1 AA (`@axe-core/playwright` at `360×740` and `390×844`, zero horizontal overflow) and English-text detector (`SC-011`) suite in `e2e/a11y/rtl-wcag-arabic.spec.js`
- [ ] T127 [P] Add automated performance & concurrency verification scripts (Playwright/Lighthouse mobile 4G LCP `< 2 s` for `SC-005`, and autocannon/k6 500-concurrent-user peak smoke test for `SC-012`) in `e2e/perf/lcp-and-load.spec.js`
- [ ] T128 [P] Configure CI pipeline (lint → shared/server/client tests → ≥ 90% coverage gate on `calc`/`machines`/`authz` → public bundle ≤ 180 KB gzip check → Playwright E2E) in `.github/workflows/ci.yml`
- [ ] T129 [P] Configure Vercel SPA deployment (`rewrites` all routes to `/index.html`, hashed asset cache headers, `VITE_API_URL` build validation) in `client/vercel.json` and `client/vite.config.js`
- [ ] T130 [P] Configure Railway always-on backend deployment (`npm --workspace server start`, `/api/health` readiness probe, `trust proxy 1`, Atlas M0 `maxPoolSize` pool tuning, env validation) in `railway.toml` and `server/src/config/db.js`
- [ ] T131 Run end-to-end `quickstart.md` local + staging smoke verification (Vercel ↔ Railway cross-domain refresh cookie, Atlas Search `READY`, Cloudinary signed upload & PDF/ZIP delivery, live Socket.IO, Arabic PDF/Excel downloads) and record verified deployment notes in `specs/001-student-projects-platform/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all User Stories (P1–P7)**.
- **Phase 3 (US1 — P1 MVP)**: Depends on Phase 2. Establishes live accounts, colleges, departments, and cycles used by P2–P7.
- **Phase 4 (US2 — P2)**: Depends on Phase 2 (and US1 organization/user services for team & supervision integration).
- **Phase 5 (US3 — P3)**: Depends on Phase 4 (`Project` approval hook copies phases).
- **Phase 6 (US4 — P4)**: Depends on Phase 4 (`Project` approval hook provisions channels); can run **in parallel** with Phase 5.
- **Phase 7 (US5 — P5)**: Depends on Phase 5 (defense eligibility requires approved phases).
- **Phase 8 (US6 — P6)**: Depends on Phase 4 (approved projects) and optionally Phase 6 (public gallery items); can run **in parallel** with Phase 7.
- **Phase 9 (US7 — P7)**: Depends on Phases 3–8 (aggregates projects, progress, supervisors, finalized grades, and showcase metrics).
- **Phase 10 (Polish, E2E & Deployment)**: Depends on all desired user stories being complete (deployment configs `T129`–`T130` can be prepared early for MVP staging).

### Within Each User Story

1. **Tests FIRST** (marked ⚠️) — write and confirm they FAIL before implementation (permissions, state machines, completion %, grading, voting).
2. **Shared pure logic** (state machines & calculators in `shared/src/`).
3. **Mongoose models** (parallelizable `[P]`).
4. **Services** (business logic, transactions, audit logs, notifications).
5. **Controllers, validation & guarded routes** (`authorize()` on every non-public route).
6. **Frontend features & pages** (parallelizable `[P]` across screens once contracts are stable) → wire routes.
7. **Checkpoint validation** — run story tests and verify independent acceptance criteria before advancing.

---

## Parallel Execution Examples

### Phase 2 (Foundational)

```bash
# Write failing tests first in parallel:
T016: server/tests/unit/authz.test.js
T017: server/tests/integration/auth-tokens.test.js
T018: shared/src/__tests__/text-and-schemas.test.js

# Build independent core models & utilities in parallel:
T019 (errors/validation) | T020 (pagination/rateLimits) | T021 (core models) | T022 (auth models) | T023 (org models)

# Build client foundation in parallel with server core:
T032 (api/upload/socket) | T033 (stores) | T034 (RTL UI kit) | T035 (layouts/guards)
```

### Phase 5 (US3 — Tracking) & Phase 6 (US4 — Chat & Media)

```bash
# Once US2 (P2) reaches its checkpoint, two streams can run concurrently:
Stream A (US3): T064 → T066 → T067..T076 (progress %, deliverables, Kanban, BOM)
Stream B (US4): T077 → T078..T086 (Socket.IO chat, comments, announcements, media)
```

### Phase 7 (US5 — Evaluation) & Phase 8 (US6 — Showcase)

```bash
# Once US3 & US4 reach checkpoints, Evaluation and Showcase can run concurrently:
Stream A (US5): T087 → T089 → T090..T098 (rubrics, defenses, blind grading, certificates)
Stream B (US6): T099 → T101 → T102..T111 (mini-sites, anti-fraud voting, competitions, investors)
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 + Phase 3 / US1)

1. Complete **Phase 1 (Setup)** and **Phase 2 (Foundational)** — verify `T016`–`T018` pass and the boot-time authz guard passes.
2. Complete **Phase 3 (US1 — P1)** — verify all P1 auth, scope-isolation, structure, and Excel import tests pass.
3. **STOP and VALIDATE**: Optionally execute `T129`–`T130` early to deploy the MVP to Vercel + Railway and verify cross-domain cookies and Arabic RTL layout live.

### Incremental Delivery (P1 → P7)

1. **Increment 1 (US1 — P1)**: Accounts, roles, colleges, departments, cycles, bulk import, dashboards.
2. **Increment 2 (US2 — P2)**: Proposals, teams, two-step approval, supervisor capacity, ideas bank.
3. **Increment 3 (US3 — P3)**: Phase templates, versioned deliverables, completion %, Kanban, BOM, reminders.
4. **Increment 4 (US4 — P4)**: Real-time Socket.IO chat, `team_only` isolation, notifications, media gallery.
5. **Increment 5 (US5 — P5)**: Rubrics, committees, blind grading, immutable locks, re-evaluation, PDF certificates.
6. **Increment 6 (US6 — P6)**: Public mini-sites, anti-fraud voting, competitions, investor interactions.
7. **Increment 7 (US7 — P7)**: Scoped dashboards, 4 required reports + insights, Arabic PDF/Excel exports.
8. **Release (Phase 10)**: Full authz matrix, Playwright E2E + WCAG/Arabic audits, Atlas Search sync, Vercel + Railway production deployment.

---

## Notes

- `[P]` tasks operate on separate files with no unmet dependencies in the same phase.
- `[US#]` labels trace each task back to its user story in `spec.md`.
- Always confirm test tasks (⚠️) fail first before writing the corresponding implementation.
- Respect `DESIGN.md` tokens, Arabic-only text via `shared/src/locales/ar.js`, and central `authorize()` on every non-public route.
- Resolve open checklist items in `checklists/security.md`, `checklists/workflows-integrity.md`, `checklists/arabic-ui-usability.md`, and `checklists/reports-performance.md` before or during the corresponding story phase.
