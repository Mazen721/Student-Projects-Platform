# Implementation Plan: منصة مشاريع الطلاب (Student Projects Platform)

**Branch**: `001-student-projects-platform` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-student-projects-platform/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A single-university, Arabic-only (RTL) platform that manages graduation projects for all colleges
end-to-end — accounts and university structure (P1), proposals/teams/supervision (P2), phases,
deliverables and progress tracking (P3), real-time communication and media (P4), defense and
evaluation (P5), a public per-project showcase with voting and investors (P6), and scoped
dashboards/reports (P7).

**Technical approach**: a MERN monorepo using npm workspaces with three packages — `client`
(React 18 + Vite SPA on Vercel), `server` (Express modular monolith + Socket.IO + node-cron on
an always-on Railway service) and `shared` (Zod schemas, role/status constants, state-machine
definitions, the Arabic text resource, and pure calculation functions). MongoDB Atlas (Mongoose)
is the only datastore; Atlas Search (`lucene.arabic`) powers project search and similar-title
detection with a normalized-text fallback. Files go browser → Cloudinary via server-signed
uploads; long videos are YouTube/Drive links. Every non-public request passes through one
central `authorize(action, resource)` middleware that evaluates role + scope
(University > College > Department > Project/Team) and injects a scope filter into queries.
Proposal and defense workflows are explicit state machines with history arrays; progress % and
grading are pure, test-first functions; finalized grades are locked and every sensitive action
is written to an append-only `auditlogs` collection. Exports use exceljs (RTL sheets) and pdfkit
with an embedded Cairo font and bidi reordering. See [research.md](./research.md) for every
decision and its alternatives.

## Technical Context

**Language/Version**: JavaScript (ES2022, native ES modules) on Node.js 22 LTS (server, tooling);
browser target: last 2 versions of evergreen browsers + iOS Safari 16+. No TypeScript (per user
request: `src/locales/ar.js`); JSDoc type hints + `// @ts-check`-free ESLint rules.

**Primary Dependencies**:
- *client*: React 18.3, Vite 6, React Router 6.30 (`createBrowserRouter`), Tailwind CSS 4
  (`@tailwindcss/vite`, CSS-first `@theme` tokens from DESIGN.md), TanStack Query 5, Axios 1,
  Zustand 5, React Hook Form 7 + `@hookform/resolvers` + Zod, socket.io-client 4, Recharts 2,
  dnd-kit (`core`, `sortable`), react-helmet-async 2, lucide-react (icons).
- *server*: Express 4.21 (pinned to 4.x — see research R-12), Mongoose 8, Socket.IO 4,
  jsonwebtoken, bcrypt, cookie-parser, helmet, cors, express-rate-limit, express-mongo-sanitize,
  cloudinary (Node SDK v2), node-cron, exceljs, pdfkit + bidi-js, multer (memory, Excel import
  only), pino (logging).
- *shared*: zod, plus zero-dependency modules (constants, state machines, calculators, `ar.js`).

**Storage**: MongoDB Atlas (M0 free tier, replica set → transactions available) via Mongoose;
Atlas Search indexes (max 3 on M0) with `lucene.arabic`; Cloudinary free plan for images and
small documents (≤10 MB each); no local disk persistence on Railway.

**Testing**: Vitest + Supertest + mongodb-memory-server (`MongoMemoryReplSet` for transactions)
for server unit/integration/contract tests; Vitest + React Testing Library + jsdom + MSW for the
client; Playwright (Chromium + mobile WebKit viewport 360×740) for E2E against a locally running
stack with an in-memory/test database; `@axe-core/playwright` for WCAG checks.

**Target Platform**: Client: static SPA on Vercel (`vercel.json` rewrites all routes to
`/index.html`). Server: single always-on Railway service (one replica) running Node 22, exposing
REST under `/api/v1`, Socket.IO under `/socket.io`, health at `/api/health`.

**Project Type**: Web application (SPA frontend + REST/WebSocket backend + shared package) in an
npm-workspaces monorepo.

**Performance Goals**: LCP < 2 s on 4G for 95% of page loads (SC-005); chat delivery < 2 s p95
(SC-006); any report for a full academic year generated (and exported) < 10 s (SC-010); 500
concurrent users / 5,000 registered users (SC-012); API p95 < 300 ms for list/detail endpoints.

**Constraints**: Arabic-only RTL UI, Cairo font, all strings in one `ar.js`; role+scope check on
every non-public route; no email of any kind; free tiers only (Atlas M0: 512 MB storage, 3
search indexes, 500 connections; Cloudinary free: 10 MB image/raw file cap; Railway single
instance); cross-site cookies between Vercel and Railway domains; mobile-first from 360 px; WCAG
2.1 AA; all lists paginated (max page size 100).

**Scale/Scope**: 1 university, ~10–20 colleges, ~5,000 users, ~1,000 projects/year, ~50 screens,
8 server modules, ~150 REST endpoints, ~12 socket events, 5 cron jobs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Pre-design | Post-design | Evidence |
|---|-----------|------|:----------:|:-----------:|----------|
| I | Arabic-Only Interface | `lang="ar" dir="rtl"`, Cairo font, single Arabic resource, Intl `ar-EG`, Arabic server errors | ✅ | ✅ | Single resource `shared/src/locales/ar.js` re-exported as `client/src/locales/ar.js` (R-03); server error handler maps error codes → Arabic messages from the same file; ESLint `react/jsx-no-literals` + prop checks reject hard-coded UI strings (R-04) |
| II | Role-Based Access & Data Isolation | One central `authorize(action, resource)`; scope-constrained queries; uniform 404-style denial; public = published only | ✅ | ✅ | `server/src/core/authz/` policy table + resource scope loaders + `req.scopeFilter` (R-07); same `can()` used by Socket.IO; denial returns `404 NOT_FOUND` "غير مصرح أو غير موجود" for scoped resources; public showcase endpoints read only `showcasepages` with `status: published` projections ([contracts/showcase.md](./contracts/showcase.md)) |
| III | Security & Privacy | bcrypt, short JWT + rotating httpOnly refresh cookie, server-side Zod, rate limits, Mongo sanitize, signed Cloudinary uploads, audit log, private contacts by default | ✅ | ✅ | R-05, R-06, R-10, R-12; `privacy` sub-document defaults to private ([data-model.md](./data-model.md) §User) |
| IV | Traceability | Versioned proposals/submissions/reviews/grades; immutable finalized grades; no hard delete | ✅ | ✅ | `history[]` arrays + `proposalversions`, `submissions` (version n), `examinerscores` (versioned), `grades.locked`, `auditlogs` append-only; soft-delete via `status`/`removedAt` (R-09) |
| V | Test-First Quality | Tests before code for permissions, progress %, grading, voting, state transitions; E2E for critical journey; ± tests per authz rule | ✅ | ✅ | `shared/src/calc/*` + `shared/src/machines/*` pure & unit-tested first; generated authz matrix test (positive + out-of-scope per policy row); Playwright journey (R-16) |
| VI | Simplicity & Modularity | 3 workspaces; 8 server modules communicating via services; schemas in `shared`; YAGNI | ✅ | ✅ | Structure below; no microservices, no Redis, no message broker, no xstate; hand-rolled 40-line FSM helper |
| VII | Accessibility & Responsiveness | Mobile-first 360 px, WCAG 2.1 AA, RTL-correct components (logical properties) | ✅ | ✅ | Tailwind v4 logical utilities (`ms-*`, `pe-*`, `start-*`), shared UI kit with focus rings, axe checks in Playwright at 360×740 and 390×844 (R-02, R-16) |
| VIII | Performance | LCP < 2 s; index per query pattern; aggregation pipelines for reports; enforced max page size | ✅ | ✅ | Route-level code splitting, Cloudinary `f_auto,q_auto` (R-15); index list per collection in data-model.md; `reports` module is aggregation-only with cached stats (R-14); `paginate()` caps `limit ≤ 100` |
| IX | Free-Tier Friendly | Atlas M0, Cloudinary free, Vercel, Railway; videos as links; paid features flagged | ✅ | ✅ | ≤3 Atlas Search indexes; 10 MB upload cap (spec's 25 MB ZIP flagged, R-10); TTL on page-view and read-notification data to respect 512 MB (R-17); Railway always-on is the user-chosen paid/credit tier — flagged below |

**Gate result: PASS** (pre-design and post-design). No NON-NEGOTIABLE principle (I, II) is
waived. Items needing justification are recorded in Complexity Tracking.

**Flagged for stakeholder confirmation (not violations):**
1. *(Resolved)* Spec Assumptions aligned with Cloudinary's free-plan 10 MB cap for all direct
   uploads (images, documents, ZIPs); larger archives use GitHub/Drive links (R-10).
2. Railway "always-on" exceeds a strictly free tier (Railway offers trial/credit-based usage);
   flagged per Principle IX as the deployment target explicitly chosen by the user.
3. Cross-site refresh cookies (`SameSite=None; Secure`) between `*.vercel.app` and
   `*.up.railway.app` can be blocked by browsers that restrict third-party cookies (Safari ITP,
   Chrome tracking protection). Plan supports custom same-site subdomains for production as the
   recommended mitigation (R-05).

## Project Structure

### Documentation (this feature)

```text
specs/001-student-projects-platform/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── README.md        # Conventions: base URL, envelope, errors, pagination, auth, authz actions
│   ├── auth.md
│   ├── organization.md
│   ├── projects.md
│   ├── tracking.md
│   ├── collaboration.md
│   ├── evaluation.md
│   ├── showcase.md
│   ├── reports.md
│   ├── uploads.md       # Cloudinary signature + attach-verification contract
│   └── socket-events.md # Socket.IO handshake, rooms, events
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
package.json                 # npm workspaces: ["client", "server", "shared"]; root scripts (dev, test, lint, e2e)
.nvmrc                       # 22
eslint.config.js             # flat config; jsx-no-literals rule for client (Principle I)
playwright.config.js
e2e/                         # Playwright end-to-end specs + fixtures/seed helpers
├── fixtures/
├── journeys/                # critical journey: register → proposal → approval → submission → defense → grade → publish → vote
└── a11y/                    # axe scans at 360×740 and 390×844

shared/
├── package.json             # name: @spp/shared, "exports" map (./schemas, ./constants, ./machines, ./calc, ./locales/ar)
└── src/
    ├── constants/           # roles.js, scopes.js, statuses.js, fileTypes.js, limits.js, gradeBands.js
    ├── schemas/             # Zod: auth, organization, projects, tracking, collaboration, evaluation, showcase, reports, common (pagination, objectId)
    ├── machines/            # fsm.js (tiny helper), proposalMachine.js, defenseMachine.js, showcaseMachine.js, contactRequestMachine.js
    ├── calc/                # progress.js, grading.js, gradeBands.js, trending.js, budget.js, windows.js (pure functions)
    ├── text/                # normalizeArabic.js (diacritics/tatweel/alef/ya/ta-marbuta), slugify.js
    ├── locales/ar.js        # THE single Arabic text resource (UI + error messages)
    └── __tests__/           # Vitest unit tests (written first) for machines, calc, schemas, normalize

server/
├── package.json
├── .env.example
└── src/
    ├── index.js             # bootstrap: db connect, http server, socket.io attach, cron start
    ├── app.js               # express app: helmet, cors, cookies, json limits, sanitize, rate limits, routes, error handler
    ├── config/              # env.js (validated with zod), db.js, cloudinary.js, cors.js
    ├── core/
    │   ├── authz/           # policies.js (action → roles/scope rule), authorize.js (middleware), can.js, scopeResolvers.js, scopeFilter.js
    │   ├── auth/            # authenticate.js (JWT access), tokens.js
    │   ├── errors/          # AppError.js, errorCodes.js, errorHandler.js (codes → Arabic via @spp/shared/locales/ar)
    │   ├── validation/      # validate.js (zod: body/query/params)
    │   ├── audit/           # audit.service.js, auditlog.model.js
    │   ├── notifications/   # notification.model.js, notify.service.js (persists + emits via socket)
    │   ├── uploads/         # cloudinarySign.js, verifyUpload.js, upload.routes.js
    │   ├── search/          # searchProvider.js (atlas | text), atlasIndexes.json
    │   ├── export/          # excel.js (exceljs RTL), pdf.js (pdfkit + Cairo + bidi), fonts/Cairo-*.ttf
    │   ├── pagination.js
    │   └── rateLimits.js
    ├── modules/
    │   ├── auth/            # user.model, refreshToken.model, invitation.model; routes, controller, service, validation
    │   ├── organization/    # university, college, department, academicYear (+semesters, cycle), import (excel)
    │   ├── projects/        # project, proposalVersion, teamInvitation, supervisorAssignment, idea, adoptionRequest
    │   ├── tracking/        # phaseTemplate, projectPhase, deliverable, submission, task, bomItem, toolItem, meeting, timelineEvent
    │   ├── collaboration/   # channel, message, comment, announcement, mediaAlbum, mediaItem, notifications routes
    │   ├── evaluation/      # rubric, committee, defense, examinerScore, grade, reevaluationRequest, certificate
    │   ├── showcase/        # showcasePage, vote, competition, competitionVote, pageView, follow, bookmark, contactRequest, challenge, publicComment
    │   └── reports/         # aggregation pipelines, statsCache model, export controllers
    │   # each module: <x>.model.js, <x>.routes.js, <x>.controller.js, <x>.service.js, <x>.validation.js, index.js (public service API)
    ├── realtime/            # socket.js (io setup, JWT handshake), chat.handlers.js, presence.js
    ├── jobs/                # scheduler.js (node-cron), deadlineReminders.js, recalcStats.js, trending.js, modificationsOverdue.js, cleanup.js
    └── scripts/             # seed-admin.js, seed-demo.js, sync-search-indexes.js
└── tests/
    ├── unit/                # services with mocked deps
    ├── integration/         # Supertest + MongoMemoryReplSet per module
    ├── authz/               # generated matrix: every policy row × (in-scope ✅, out-of-scope ❌)
    └── contract/            # response-shape tests against contracts/*.md schemas (zod)

client/
├── package.json
├── .env.example             # VITE_API_URL
├── vercel.json              # rewrites all routes → /index.html
├── index.html               # <html lang="ar" dir="rtl">, Cairo preconnect/stylesheet
└── src/
    ├── main.jsx             # QueryClientProvider, HelmetProvider, RouterProvider
    ├── index.css            # @import "tailwindcss"; @theme tokens from DESIGN.md; base RTL rules
    ├── locales/ar.js        # re-export of @spp/shared/locales/ar (single source)
    ├── lib/                 # api.js (axios + refresh interceptor), queryClient.js, socket.js, format.js (Intl ar-EG), cloudinaryUpload.js
    ├── stores/              # authStore.js (access token in memory, user, active role), uiStore.js
    ├── components/ui/       # Button, Input, Select, Textarea, Field, Card, Badge, Tabs, Modal, Drawer, Table/ResponsiveTable, Pagination, Skeleton, EmptyState, ProgressBar, Toast, Avatar, FileUploader, Dock, TopNav
    ├── components/          # domain components (ProjectCard, StatusBadge, KanbanBoard, ChatPanel, charts/*)
    ├── layouts/             # AppLayout (TopNav + Dock), PublicLayout, AuthLayout
    ├── routes/              # router.jsx (lazy routes), guards (RequireAuth, RequireRole)
    ├── features/            # auth, organization, projects, tracking, collaboration, evaluation, showcase, reports — pages + hooks (useXQuery/useXMutation)
    └── test/                # setup.js (RTL, MSW), test-utils.jsx
```

**Structure Decision**: npm-workspaces monorepo with `client/`, `server/`, `shared/` (Principle
VI). The server is a modular monolith; cross-module calls go only through each module's
`index.js` service exports (enforced by ESLint `no-restricted-imports` on `modules/*/*.model.js`
from other modules). Cross-cutting concerns that every module needs (authz, audit, notifications,
uploads, search, export) live in `server/src/core/` rather than in a business module. `shared/`
holds everything both sides must agree on: Zod schemas, constants, state machines, pure
calculators and the single Arabic text resource. E2E tests live at the root because they span
both apps.

## Complexity Tracking

> Items that could be read as tension with the constitution, with justification.

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|-------------------------------------|
| Arabic resource physically in `shared/src/locales/ar.js`, with `client/src/locales/ar.js` as a one-line re-export | Principle I demands ONE string file and Arabic server error messages "from the same resource"; the server cannot import from `client/` | Keeping strings only in `client/` forces a second server-side message file (two sources of truth) |
| Excel import uploaded to the server (multer, memory only) instead of Cloudinary | File is parsed transiently and never stored; Cloudinary signed-upload rule targets persisted files | Uploading to Cloudinary then downloading server-side doubles transfer and storage for a throwaway file |
| Separate `competitionvotes` collection alongside `votes` | User mandated unique index `votes {projectId, userId}`; FR-104 also needs one vote per project *per competition* | A single collection would require changing the mandated unique index to include `competitionId` |
| Search provider abstraction (`atlas` / `text`) | Atlas `$search` is unavailable in mongodb-memory-server and local MongoDB; tests and local dev need a fallback | Atlas-only search makes integration tests impossible offline |
| `core/` layer next to `modules/` | Authz, audit, notifications, uploads, exports are used by all 8 modules; placing them in one business module would create cross-module model access | Duplicating them per module violates DRY and Principle II's single enforcement point |
