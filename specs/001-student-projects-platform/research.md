# Phase 0 Research: منصة مشاريع الطلاب

**Feature**: `001-student-projects-platform` | **Date**: 2026-11-23 | **Plan**: [plan.md](./plan.md)

All technical-context unknowns are resolved below. Each entry: **Decision**, **Rationale**,
**Alternatives considered**. The user's stack request is treated as binding; research focuses on
*how* to apply it safely within the constitution and free-tier limits.

---

## R-01 — Monorepo, language and versions

- **Decision**: npm workspaces (`client`, `server`, `shared`) with a root `package.json`; plain
  JavaScript with native ES modules everywhere (`"type": "module"`); Node.js 22 LTS pinned via
  `.nvmrc` and `engines`. `shared` is consumed as `@spp/shared` through an `exports` map
  (`./schemas`, `./constants`, `./machines`, `./calc`, `./text`, `./locales/ar`) with no build
  step (Vite and Node both import ESM source directly). Key versions: React 18.3, Vite 6,
  React Router 6.30, Tailwind 4, TanStack Query 5, Zustand 5, Zod 3.24 (stable with
  `@hookform/resolvers`), Mongoose 8, Socket.IO 4, Express 4.21.
- **Rationale**: The user asked for `ar.js` and npm workspaces; no build step for `shared` keeps
  local dev and Railway/Vercel builds simple. Vercel builds only `client` (root directory
  `client`, install from repo root so the workspace link resolves); Railway runs `server` with
  `npm --workspace server start`.
- **Alternatives**: TypeScript (stronger typing, but contradicts the requested `.js` resource and
  adds build steps); pnpm/Turborepo (faster, but unrequested complexity); Zod 4 (newer, but
  ecosystem resolvers/error-map APIs still shifting — revisit later).

## R-02 — RTL styling, font and shared UI kit

- **Decision**: Tailwind CSS v4 via `@tailwindcss/vite`, with DESIGN.md tokens copied verbatim
  into `@theme` in `client/src/index.css` (`--color-navy`, `--color-gold`, …,
  `--font-sans: "Cairo", system-ui, sans-serif`). `index.html` sets `<html lang="ar" dir="rtl">`.
  Cairo (weights 400/600/700/800/900, `display=swap`, Arabic subset) loaded from Google Fonts with
  `preconnect`. Components use only logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`,
  `start-*`, `end-*`, `text-start`, `border-s`), `rtl:-scale-x-100` for directional icons (arrows, chevrons, send), drawers from `inline-start`, toasts at `bottom-end`/`top-end`, RTL Kanban column order with an accessible "نقل إلى..." menu on every card (`dnd-kit` Arabic `announcements`), and RTL `Recharts` charts paired with accessible HTML table alternatives. A small UI kit in `client/src/components/ui`
  (Button with `loading` state, Field/Input/Select/Textarea with `shouldFocusError` & Arabic error, Card,
  Badge with icon+Arabic label, Tabs with horizontal scroll + roving tabindex, Modal/Drawer with focus trap + `Escape` + bottom-sheet < `md`,
  ResponsiveTable switching `≥ md` table to `< md` stacked cards with primary at `inline-start` and actions at `inline-end`, Pagination in RTL order, Skeleton with `prefers-reduced-motion` support,
  EmptyState with optional CTA, ProgressBar with `bg-gradient-to-l`, Toast with `aria-live="polite|assertive"`, Avatar with navy-initial fallback, FileUploader hiding native file input with progress/cancel, TopNav,
  Dock, plus skip-to-content link and `min-h-11 min-w-11` 44px targets). ESLint bans physical utilities (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`,
  `text-left/right`) via a custom AST/regex ESLint rule (avoiding Tailwind v4 plugin incompatibilities).
- **Rationale**: Constitution mandates Cairo (the user's "Cairo or Tajawal" → Cairo); DESIGN.md
  mandates `@theme` tokens; logical properties make RTL correctness structural, not manual.
- **Alternatives**: Tajawal (rejected by Principle I); Tailwind v3 + `tailwindcss-rtl` plugin
  (obsolete since v3.3/v4 ship logical utilities); headless libs like Radix (good a11y, but adds
  weight; may be adopted for Dialog/Popover focus management if needed — kept optional).

## R-03 — Location of the single Arabic text resource

- **Decision**: The one Arabic resource is `shared/src/locales/ar.js` (nested object: `common`,
  `nav`, `auth`, `org`, `projects`, `tracking`, `chat`, `evaluation`, `showcase`, `reports`,
  `statuses`, `roles`, `gradeBands`, `timeline`, `notifications`, `rules`, `errors`, `validation`). `client/src/locales/ar.js` contains only
  `export { default } from '@spp/shared/locales/ar';` so components import `@/locales/ar` as the
  user requested. Zod schemas in `shared` reference **message keys** (e.g.
  `'validation.required'`, `'validation.teamSizeMax'`) rather than literal text; a `t(key, vars)`
  helper resolves keys with simple `{name}` interpolation on both sides, and `pluralAr(count, forms)` uses `Intl.PluralRules('ar-EG')` for singular/dual/3–10/11+ counters. Missing keys fail unit checks.
- **Rationale**: Principle I requires a single resource *and* Arabic server errors from the same
  resource; the server cannot import from the client workspace.
- **Alternatives**: Two files (client UI + server errors) — violates "single resource"; i18next —
  multi-locale framework explicitly unneeded per constitution.

## R-04 — Enforcing Arabic-only UI and locale formatting

- **Decision**: ESLint `react/jsx-no-literals` (error, allowing only punctuation/whitespace)
  plus a rule banning string literals in `placeholder`, `title`, `aria-label`, `alt` props, covering `<title>` (`react-helmet-async`), ErrorBoundary fallbacks, and custom `<FileUploader>` buttons.
  `client/src/lib/format.js` wraps cached `Intl.DateTimeFormat('ar-EG-u-ca-gregory', …)`,
  `Intl.NumberFormat('ar-EG-u-nu-latn')` (standardized Western Arabic digits `0–9` with Arabic words/currency `ج.م` and 1-decimal `%`/grades), `Intl.RelativeTimeFormat('ar-EG')`, percent and currency (EGP)
  formatters; all charts/tables use these. Numeric form inputs normalize Eastern Arabic-Indic digits (`٠–٩` → `0–9`) and `٫` → `.` prior to Zod parsing. Dates are stored UTC and displayed in
  `Africa/Cairo` (`timeZone` option, DST-aware). Playwright includes an "English text detector" scan
  (`/[A-Za-z]{3,}/` on visible UI text excluding `[data-user-content]` and allow-listed proper nouns: GitHub, YouTube, Google
  Drive, URLs, emails, slugs, file extensions PDF/ZIP, college codes, and tech tags) for SC-011.
- **Rationale**: Turns Principle I into an automated gate rather than review-only.
- **Alternatives**: Manual review only — unreliable at ~50 screens.

## R-05 — Authentication tokens and cross-site cookies

- **Decision**:
  - Access token: JWT HS256 signed with `JWT_SECRET`, TTL 15 min, claims `{sub, tv}` (`tv` =
    user `tokenVersion` for global revocation). `authenticate` verifies `tv === user.tokenVersion` and `user.status === 'active'` via an indexed lean lookup on `users`, giving **0-second revocation lag** on password change/reset, deactivation, or role revocation. Sent as `Authorization: Bearer`. Kept **in memory only** (Zustand, not localStorage).
  - Refresh token: JWT signed with `JWT_REFRESH_SECRET`, TTL 7 days, claims `{sub, fam, jti}`;
    stored server-side as a SHA-256 hash in `refreshtokens` (TTL index on `expiresAt`). Cookie
    `spp_rt`: `HttpOnly; Secure; SameSite=None; Path=/api/v1/auth; Max-Age=604800`.
  - Rotation on every `/auth/refresh`; reuse of a rotated token revokes the whole family
    (`fam`) → forces re-login. Logout revokes the current token; password change/reset and
    deactivation increment `tokenVersion` and revoke all families.
  - CSRF on the cookie route: `/auth/refresh` and `/auth/logout` require header
    `X-Requested-With: spp` and `Origin` (or `Referer` origin fallback if browser omits `Origin`) matching the exact `CLIENT_URL` allow-list in production (`403 FORBIDDEN` otherwise); responses carry the new access
    token in the JSON body (only readable by the allowed origin).
  - `mustChangePassword` flag (temp passwords from admin reset/import/invite: 12 chars, single-use until changed) returns a limited
    token that permits ONLY `POST /auth/change-password`, `POST /auth/logout`, and `GET /auth/me` (all other REST endpoints return `403 PASSWORD_CHANGE_REQUIRED`, and Socket.IO refuses the handshake). User-chosen passwords require `8–72` characters (respecting bcrypt's 72-byte limit) with at least one letter and one digit.
  - Cross-site risk: `vercel.app` ↔ `up.railway.app` are different sites, so the refresh cookie
    is third-party. Browsers that block third-party cookies (Safari ITP; Chrome with tracking
    protection) would break silent refresh. **Production recommendation**: serve both under the
    university domain (e.g. `projects.univ.edu.eg` on Vercel and `api.projects.univ.edu.eg` on
    Railway custom domain) — same-site, cookie becomes first-party while keeping
    `SameSite=None; Secure` working. Fallback if custom domains are unavailable: the client
    detects refresh failure and redirects to login (session = access token lifetime), with an
    Arabic notice.
- **Rationale**: Matches the user's spec and Principle III (rotation + revocation) while
  surfacing the real-world third-party-cookie limitation.
- **Alternatives**: Vercel rewrite proxy `/api → Railway` (first-party cookies, but WebSockets
  are not proxied by Vercel rewrites and adds latency; rejected); refresh token in localStorage
  (XSS-exposed; rejected); sessions in Mongo (stateful; unnecessary).

## R-06 — Client data layer and token refresh interceptor

- **Decision**: One Axios instance (`baseURL = VITE_API_URL + '/api/v1'`, `withCredentials:
  true`). Request interceptor attaches the in-memory access token and `X-Role-Context` (active
  role-assignment id). Response interceptor: on `401` with code `TOKEN_EXPIRED`, a
  **single-flight** refresh promise is shared by all concurrent failures; queued requests replay
  after success; on refresh failure → clear auth store, cancel queries, navigate to `/login`.
  On app start, `/auth/refresh` is called once to restore the session. Client error UX: offline/timeout displays an Arabic retry banner; refresh failure on dirty forms warns before `/login` redirect; `404` renders Arabic unavailable/not-found; `429` displays `Retry-After` cooldown; `500` offers retry; Socket.IO disconnect shows a non-blocking reconnect pill. TanStack Query defaults:
  `staleTime` 30 s, `retry` 1 (never on 4xx), query keys from a `queryKeys` factory per feature;
  Socket.IO events invalidate/patch relevant queries (`notifications`, `messages`). Zustand only
  for auth (token, user, roles, active role) and UI (dock/sidebar, toasts). Forms: React Hook
  Form (`shouldFocusError: true`) + `zodResolver(sharedSchema)`; per-field errors rendered via `t(issue.message)` with a `role="alert"` summary.
- **Rationale**: Standard, race-free refresh pattern; server state stays in Query cache, not
  Zustand.
- **Alternatives**: RTK Query (heavier); storing tokens in cookies readable by JS (XSS risk).

## R-07 — Central authorization `authorize(action, resource)`

- **Decision**:
  - **Role assignments** live in `users.roles[]` as `{_id, role, scopeType, scopeId,
    collegeId, departmentId}` (denormalized ancestors so a scope check is an equality test).
  - **Policy table** `core/authz/policies.js`: `action` (e.g. `project.update`,
    `proposal.decide`, `grade.finalize`) → list of rules `{ roles: [...], scope:
    'university'|'college'|'department'|'project'|'self'|'team'|'defense', when?: (ctx) => bool }`.
    Relationship roles (team leader/member, supervisor/co-supervisor/mentor of a project,
    committee member of a defense) are computed from the resource, not stored as global roles.
  - **Resource scope loaders** `scopeResolvers.js`: `resource` name → function loading the
    minimal scope document (`{collegeId, departmentId, projectId, teamMemberIds,
    supervisorIds, …}`) by id from `req.params`, cached on `req`.
  - **Middleware** `authorize(action, resource)` → resolves scope → `can(user, action, scope)`;
    on deny: `404 NOT_FOUND` for id-addressed resources (no existence leak), `403 FORBIDDEN` for
    collection-level creates. For list endpoints it sets `req.scopeFilter` (a Mongo filter such
    as `{collegeId: {$in: [...]}}`) that services MUST merge into queries — no fetch-then-filter.
  - **Role context**: list/dashboard read endpoints honor `X-Role-Context` to restrict the filter to
    one assignment (FR-012 dashboard switching); invalid/revoked `X-Role-Context` values fail with `403 FORBIDDEN`. Write and id-addressed endpoints ignore `X-Role-Context` and evaluate all active assignments against the resolved resource scope.
  - Cross-college read-only (FR-034): partner college/department admins get rule
    `{roles:[collegeAdmin, departmentAdmin], scope:'partner', actions: project.readSummary,
    grade.readStudentFinal}`.
  - The same `can()` is used in Socket.IO join/emit handlers and cron jobs never bypass services.
  - Every route file declares `authorize(...)` or `publicRoute()`; a startup check walks the
    Express router and fails boot if any `/api/v1` route lacks one of the two markers.
- **Rationale**: Principle II's single enforcement point; scope filter avoids leakage; boot
  check prevents forgotten guards.
- **Alternatives**: CASL (capable, but rules-with-conditions over Mongo docs add a learning curve;
  the hierarchy is simple enough for a 200-line in-house engine); per-route ad-hoc checks
  (prohibited).

## R-08 — Workflow state machines

- **Decision**: A ~40-line `shared/src/machines/fsm.js` → `defineMachine({ initial, states,
  transitions: { EVENT: { from: [...], to, roles?: [...], guard?: (ctx)=>code|null } } })`
  returning `{ can(state, event, ctx), next(state, event, ctx) }`. Machines:
  - **Proposal**: `draft → submitted → under_review → needs_changes → submitted … →
    supervisor_recommended → approved | rejected` (+ `withdrawn` from draft/submitted/
    needs_changes; `supervisor_recommended → needs_changes` by admin return; `approved → archived`
    on year rollover).
  - **Defense** (per project): `not_eligible → eligible → scheduled → grading → deliberation? →
    finalized → reevaluation_requested → reevaluation_open → finalized` (+
    `reevaluation_requested → finalized` on rejection).
  - **Post-defense modifications**: `none → pending → confirmed | overdue → confirmed`.
  - **Showcase page**: `draft → pending_approval → published ⇄ unpublished_by_team`;
    `published → taken_down → pending_approval` (re-approval required).
  - **Contact request**: `pending → accepted | declined | withdrawn`.
  Services apply transitions inside a Mongo transaction: guard → update `status` → push to
  `history[]` `{from, to, event, actorId, comment, at}` → write `auditlogs` when the event is
  sensitive → emit notifications.
- **Rationale**: Explicit, unit-testable transitions shared with the client (to show only
  allowed buttons).
- **Alternatives**: xstate (powerful, overkill for linear workflows); status checks scattered in
  services (untestable).

## R-09 — Versioning, grade locking and audit log

- **Decision**: `proposalversions` snapshot proposal fields on each submit/edit after first
  submission; `submissions` carry incremental `version` per deliverable; `examinerscores` are
  versioned (`version`, `supersededAt`) and never updated in place; `grades` has `locked`,
  `finalizedAt`, `finalizedBy`, `version`. A Mongoose `pre(['updateOne','findOneAndUpdate',
  'save'])` hook on `grades` and `examinerscores` rejects writes when locked unless the service
  passes `{ reevaluationId }` that references an approved, open re-evaluation. `auditlogs` is
  append-only (no update/delete routes; model hooks throw on update/delete), fields: `actorId,
  actorRole, action, targetType, targetId, scope{collegeId,departmentId,projectId}, before,
  after, reason, ip, at`; indexes on `(scope.collegeId, at)`, `(targetType, targetId, at)`,
  `(actorId, at)`. No hard deletes for academic records — `status: 'deactivated'|'archived'`,
  `removedAt/removedBy` for moderated content.
- **Rationale**: Principle IV; DB-level guard is defense-in-depth beyond service checks.
- **Alternatives**: Mongo change streams to an audit collection (needs extra worker; M0 supports
  them but adds moving parts).

## R-10 — Cloudinary signed direct uploads

- **Decision**:
  - `POST /api/v1/uploads/sign` (authorized per purpose: `deliverable`, `gallery`, `avatar`,
    `cover`, `form`, `chat`, `certificateLogo`) returns `{cloudName, apiKey, timestamp,
    signature, folder, publicId, resourceType, type, allowedFormats, maxBytes}`; signature over
    `timestamp, folder, public_id, type, allowed_formats` using `CLOUDINARY_API_SECRET`
    (`cloudinary.utils.api_sign_request`). Signatures valid 10 min (`timestamp` freshness).
  - Delivery `type`: `upload` (public) for avatars, covers, public gallery, phase forms;
    `authenticated` for deliverables, chat attachments, private gallery → server returns
    short-lived signed delivery URLs (`sign_url: true`) only to authorized users.
  - Resource types: images → `image`; PDF → `image` (enables preview); Word/PowerPoint/ZIP →
    `raw`.
  - **Size**: Cloudinary free plan caps image and raw files at **10 MB** — the spec's 25 MB ZIP
    allowance cannot be honored on the free plan. Enforce 10 MB for all types client-side
    (pre-check) and server-side (attach verification); suggest a GitHub/Drive link above that.
  - **Attach verification**: the browser posts the Cloudinary upload response to the domain
    endpoint (e.g. submit deliverable); the server verifies
    `cloudinary.utils.verify_api_response_signature(public_id, version, signature)`, checks
    `bytes ≤ limit`, `format ∈ allowed`, `folder` prefix matches the signed purpose/project, then
    stores `{publicId, url, resourceType, type, format, bytes, originalName}`. Unverified or
    out-of-policy assets are deleted via `cloudinary.uploader.destroy`.
  - Account setting: enable "Allow delivery of PDF and ZIP files" (disabled by default on free
    accounts) — documented in quickstart.
  - Orphans: nightly cleanup job deletes assets in `tmp/` folders older than 24 h that were never
    attached (tracked in `pendinguploads` with TTL).
- **Rationale**: Principle III (signed only, type/size enforced) and IX (free plan limits).
- **Alternatives**: Upload via server (multer → Cloudinary) — doubles bandwidth on Railway;
  unsigned presets — prohibited.

## R-11 — Arabic search and similar-title detection

- **Decision**:
  - `SEARCH_PROVIDER=atlas|text` (default `atlas` in production, `text` in tests/local).
  - **Atlas Search** (≤3 indexes on M0 — only 2 used, each < 15 mapped fields & < 3 KB): (1) `projects_search` on `projects` — `title`,
    `titleNormalized`, `idea`, `keywords`, `field` with `lucene.arabic`, plus `token` fields
    `collegeId`, `departmentId`, `academicYearId`, `status`, `isPublished` for filtering;
    (2) `messages_search` on `messages` — `textNormalized` (`lucene.arabic`) + `channelId` token;
    (3) reserved (users directory search if needed). Definitions kept in
    `server/src/core/search/atlasIndexes.json` and applied by `scripts/sync-search-indexes.js`
    (`collection.createSearchIndex`).
  - **Similar titles** (FR-032): `$search` `compound.should[ text(title, fuzzy maxEdits 1),
    moreLikeThis({title}) ]` scoped to the university, excluding self, top 5 with score ≥
    threshold (tuned, start 3.0); warning only.
  - **Fallback** (`text`): MongoDB `$text` does not support Arabic stemming, so store
    `titleNormalized`/`textNormalized` produced by `shared/text/normalizeArabic.js` (strip
    tashkeel and tatweel, unify أ/إ/آ→ا, ى→ي, ة→ه, Arabic-Indic digits → ASCII) and create a
    text index with `default_language: 'none'`. Similar titles in fallback: `$text` candidates
    (top 50) → trigram Jaccard similarity in `shared/text/similarity.js` ≥ 0.45.
  - Public showcase search uses the same index with `isPublished: true` filter.
- **Rationale**: User-specified Atlas Search with Arabic analyzer, honoring M0's 3-index limit
  and keeping tests runnable offline.
- **Alternatives**: Regex search (no ranking, scans); external Elastic/Algolia (paid/extra
  service).

## R-12 — Express version and security middleware

- **Decision**: Pin **Express 4.21.x** — `express-mongo-sanitize` (user-requested) mutates
  `req.query`, which is a read-only getter in Express 5 and throws. Middleware order: `app.set('trust proxy', 1)` (trusts Railway's single edge proxy hop so spoofed `X-Forwarded-For` headers cannot bypass IP limits) → `helmet()` (API: default CSP off for JSON, HSTS on) → `cors({ origin:
  allowList(CLIENT_URL), credentials: true })` (CLIENT_URL may be a comma-separated list of exact
  origins, e.g. production + staging; no wildcards) → `express.json({limit:'1mb'})` →
  `cookieParser()` → `mongoSanitize()` → global limiter (300 req/15 min/IP, configurable via `RATE_LIMIT_GLOBAL_MAX` for campus NAT) → route-specific
  limiters with `standardHeaders: true` (`Retry-After` on `429 RATE_LIMITED`): auth `10/15 min/(IP+normalizedEmail)` (avoids campus NAT lockouts); votes `30/h/userId` + `60/h/IP`; writes `60/min/userId`;
  uploads/sign `30/10 min/userId` → routes → 404 → `errorHandler`. Additionally
  `mongoose.set('sanitizeFilter', true)` and strict Zod schemas (`.strict()`) on all bodies.
  Error handler maps `AppError(code, status, vars)`, Zod errors (`VALIDATION_ERROR` with
  `fields[{path, code, message}]`), Mongo duplicate key (`11000` → `DUPLICATE_<FIELD>`), and
  unknown errors (`INTERNAL_ERROR`, no stack in production) to `{ error: { code, message } }`
  where `message` is Arabic from `ar.errors[code]`.
- **Rationale**: Honors the requested middleware without monkey-patching; layered NoSQL-injection
  defense.
- **Alternatives**: Express 5 + `@exortek/express-mongo-sanitize` fork (viable later); Express 5
  + `req.query` redefinition hack (fragile).

## R-13 — Real-time chat and notifications (Socket.IO)

- **Decision**: Socket.IO attached to the same HTTP server, `path: '/socket.io'`, CORS = same
  allow-list, `transports: ['websocket', 'polling']`. Handshake `auth: { token }` (access JWT)
  verified in `io.use`; on expiry the client refreshes then reconnects with the new token.
  `channel:join` is authorized with `can(user, 'channel.read', channelScope)` — team-only channels exclude
  supervisors (FR-070); `@mentions` notify only active `channel.memberIds`. Mid-session user deactivation, password change/reset, role revocation, or team removal immediately disconnects or evicts affected sockets. Client chat aligns own messages to `inline-start` (navy bubble), others to `inline-end` (white card), truncates long filenames, and supports keyboard navigation in `@mention` popovers. Events: `message:send` (ack with persisted message), `message:new`,
  `message:read` → `receipt:update`, `typing:start/stop` (throttled 1/2 s, not persisted),
  `message:removed`, `notification:new`, `notification:count`. Messages persist to Mongo first,
  then emit (single instance → no adapter needed). Read receipts stored as `readBy[{userId,
  at}]` capped to channel members, plus per-member `lastReadAt` on channel membership for unread
  counts. Admin removal replaces content with tombstone and emits `message:removed`.
  Single Railway replica; if scaled later, add `@socket.io/mongo-adapter` (documented, not built
  — YAGNI).
- **Rationale**: Meets SC-006 (<2 s) with minimal infra; same JWT and policy engine as REST.
- **Alternatives**: Pusher/Ably (external, quotas); polling (latency, load).

## R-14 — Reports, cached stats and cron jobs

- **Decision**: `reports` module exposes aggregation pipelines only (`$match` with the authz
  `scopeFilter` first, then `$group/$lookup/$facet`, projecting minimal fields before `$lookup` to stay well under Atlas M0's 100 MB stage limit without `allowDiskUse`), backed by indexes on `(academicYearId,
  collegeId, departmentId, status)`. Heavy cross-collection metrics are pre-computed into
  `statscaches` documents keyed `{kind, yearKey, scopeType, scopeId}` by `node-cron` (pinned to `timezone: 'Africa/Cairo'`, processing scopes in batches of 50 to protect API `< 300 ms` p95):
  - `*/15 * * * *` `recalcStats` — completion, supervisor load, late rates per scope (incremental
    by `updatedAt` watermark across projects/grades/submissions/BOM/votes, plus dirty-scope invalidation on grade re-finalization, reassignment, or year rollover, and drift reconciliation for `projects.showcaseStats`), and freezes any competition whose `endsAt <= now` (`frozenRanking` also computed lazily on read/vote at expiry).
  - `0 * * * *` `trending` — `validVotes7d × 3 + uniqueViews7d` into `projects.showcaseStats`.
  - `0 7 * * *` (Africa/Cairo) `deadlineReminders` — notifications for due in 3 days, 1 day,
    today (FR-060); idempotent via unique `notifications.dedupeKey`.
  - `30 7 * * *` `modificationsOverdue` — flag overdue post-defense modifications (US5-7).
  - `0 3 * * *` `cleanup` — orphan Cloudinary temp uploads, expired invitations.
  Jobs take an atomic lease lock in `joblocks` (`lockedUntil: now + 10m`, auto-recovering after crash/restart) so accidental double
  instances don't duplicate work. Exports reuse the exact same pipeline result object as the
  on-screen endpoint (SC-010 parity) — the controller passes the result to `excel.js`/`pdf.js`.
- **Rationale**: Principle VIII (aggregation, not loops) and SC-010 (<10 s, parity).
- **Alternatives**: Materialized `$merge` views (good, but scheduling still needed); Agenda/Bull
  (needs Redis or extra collections and workers).

## R-15 — Frontend performance (LCP < 2 s)

- **Decision**: Route-based code splitting (`React.lazy` per feature; Recharts, dnd-kit, chat
  in separate chunks); public pages (`/`, `/p/:slug`, `/colleges/:id`) in a lean public bundle
  without dashboard libraries; Cloudinary transformation URLs `f_auto,q_auto,w_{n},c_fill` with
  `srcset` and `loading="lazy"` (hero image `fetchpriority="high"`); font `preconnect` +
  `display=swap`; TanStack Query `placeholderData` for list pagination; Vercel serves hashed
  assets with immutable caching. Budget: initial JS ≤ 180 KB gzip for public routes, checked with
  `rollup-plugin-visualizer` in CI.
- **Rationale**: SC-005 on mid-range phones over 4G.
- **Alternatives**: SSR/Next.js (better SEO for mini-sites, but contradicts the requested Vite SPA;
  noted as a future option for showcase SEO).

## R-16 — Testing strategy

- **Decision**:
  - `shared`: Vitest unit tests written first for `calc/progress`, `calc/grading`,
    `calc/gradeBands`, `calc/trending`, `machines/*`, `text/normalizeArabic`, schemas (incl.
    SC-007 table-driven cases from the spec: 20% phase/2 deliverables → +10; 40/60 split → 80).
  - `server`: Vitest + Supertest + `MongoMemoryReplSet` (transactions). Integration tests per
    module; **authz matrix** generated from `policies.js`: for every action, one in-scope
    positive and one out-of-scope negative request (SC-004 = 100%). Socket tests with
    `socket.io-client` against an ephemeral server. Cloudinary mocked at `core/uploads` boundary.
    `SEARCH_PROVIDER=text`.
  - `client`: Vitest + RTL + MSW — interceptor refresh queue, forms with Arabic errors, RTL
    components, Kanban keyboard moves, guards.
  - `e2e`: Playwright against `npm run dev:e2e` (server with in-memory replset + seed, client
    via Vite preview); critical journey; voting duplicate/age; scope denial; axe scans at
    360×740 and 390×844; English-text detector.
  - CI (GitHub Actions): lint → unit → integration → build → e2e; coverage gate 90% for
    `shared/calc`, `shared/machines`, `core/authz`.
- **Rationale**: Principle V.
- **Alternatives**: Jest (slower ESM support); Cypress (heavier, weaker WebKit coverage).

## R-17 — Free-tier storage budget (Atlas M0 512 MB)

- **Decision**: TTL indexes on `pageviews` (35 days), `refreshtokens` (`expiresAt`),
  `invitations` (`expiresAt` + 30 days for audit visibility), `pendinguploads` (24 h),
  notifications read > 180 days; `auditlogs` has no TTL (immutable Principle IV). No binary data in Mongo; messages stored as text +
  attachment metadata only. Estimated year-1 footprint: ~150–250 MB. Admin dashboard exposes
  `db.stats()` (`dataSize + indexSize` vs 512 MB) for University Admin with amber warning at `≥ 350 MB` and red critical alert at `≥ 440 MB` for offline archival planning.
- **Rationale**: Principle IX.
- **Alternatives**: Upgrade tier (paid; flag only when exceeded).

## R-18 — Excel and PDF exports (Arabic, RTL)

- **Decision**: **exceljs**: worksheets with `views: [{ rightToLeft: true }]`, Arabic headers
  from `ar.js`, top scope/year/timestamp metadata rows, typed numeric/percentage/date formats, frozen header row, column widths, formula-injection escaping (prefix leading `=`, `+`, `-`, `@`, `\t`, `\r` with `'`), streamed directly to `res` via
  `workbook.xlsx.write(res)`. **pdfkit**: embed `Cairo-Regular.ttf` and `Cairo-Bold.ttf`
  (OFL) from `core/export/fonts`; all text passes through `rtl(text)` which (1) runs the Unicode
  bidi algorithm with `bidi-js` to get visual order per line, (2) relies on fontkit OpenType
  GSUB (`init/medi/fina/isol/rlig/liga`) for contextual joining, and (3) lays out lines
  right-aligned with manual wrapping measured by `doc.widthOfString`. A small table helper
  renders RTL columns (first column at the right) with repeated headers across page breaks and `صفحة X من Y` footers. Certificates/result letters use a fixed A4
  template with university/college logo (Cloudinary URL fetched server-side with 2 s timeout, cached in memory, falling back cleanly to text header if fetch fails). Both formats emit `UTF-8` RFC 5987 `Content-Disposition` filenames, render clean Arabic empty states when 0 rows match, and cap concurrent heavy exports (`≤ 2`) to complete `< 10 s` on Railway.
  Validation: golden tests compare extracted text order and page count; a manual visual review
  checklist for shaping. Fallback if shaping proves faulty: pre-shape with Arabic presentation
  forms (`arabic-persian-reshaper`) before bidi.
- **Rationale**: User-mandated libraries; pdfkit has no native bidi, so explicit handling is
  required.
- **Alternatives**: Headless Chrome HTML→PDF (perfect shaping, but ~300 MB Chromium on Railway);
  pdfmake-rtl (less control for certificates).

## R-19 — Voting integrity

- **Decision**: `votes` unique index `{projectId: 1, userId: 1}` (as requested);
  `competitionvotes` unique `{competitionId, projectId, userId}`. Eligibility (pure function in
  `shared/calc/voteEligibility.js`): account `active`, age ≥ `university.settings.minVoteAccountAgeHours`
  (default 24), not team member/supervisor/co-supervisor/mentor of the project, project
  published, competition open and voter restriction satisfied (university email domain).
  Burst detection: per-IP sliding counter in a `voteip` collection (TTL 1 h); only votes arriving **after** `count > voteBurstPerIp10m` (default 10, configurable by University Admin for campus NAT) are stored with `status: 'flagged'`, excluded from counts until an admin clears
  it (audited; `clear` atomically `$inc`s `validVotes` and `votes7d`). Counts maintained by `$inc` on `projects.showcaseStats.validVotes` inside the same
  transaction as the vote insert/delete/status change. IP stored as salted hash.
- **Rationale**: FR-104/105, SC-008 guaranteed by the unique index even under races.
- **Alternatives**: CAPTCHA (third-party, conflicts with policy against automated bypass and
  free-tier UX); device fingerprinting (privacy concerns).

## R-20 — Bulk Excel import

- **Decision**: `multer.memoryStorage()` with 5 MB limit, `.xlsx` MIME + magic-byte (`PK\x03\x04`) check, max 2,000 rows and decompressed-size zip-bomb guard;
  parsed by exceljs; header validation against the downloadable template (wrong columns → reject
  whole file with template link); each row validated by the shared `importStudentRowSchema`;
  duplicates within file and DB detected; valid rows inserted in batches of 100 with bcrypt
  (cost 12) at concurrency 4; temporary passwords (12 chars) returned **once** in the response
  as a downloadable Excel of credentials (`Cache-Control: no-store`, formula-escaped) + row-level Arabic error report. Never persisted to disk.
  500 rows ≈ 40–60 s (SC-003).
- **Rationale**: FR-019 within SC-003.
- **Alternatives**: Client-side parsing (still must validate server-side; doubles logic).

## R-21 — Deployment and environment

- **Decision**:
  - **Vercel** (client): root directory `client`, framework Vite, build `npm run build`, output
    `dist`; `vercel.json`: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
    (static assets are served before rewrites). Env: `VITE_API_URL` (e.g.
    `https://api.projects.univ.edu.eg`).
  - **Railway** (server): service from repo root, start `npm --workspace server start`, health
    check `/api/health` (checks Mongo ping), 1 replica, always-on. Env (required, validated at
    boot with Zod): `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLOUDINARY_CLOUD_NAME`,
    `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLIENT_URL`. Optional with defaults: `PORT`
    (Railway-provided), `NODE_ENV`, `SEARCH_PROVIDER` (`atlas`), `ACCESS_TOKEN_TTL` (`15m`),
    `REFRESH_TOKEN_TTL` (`7d`), `TZ_DISPLAY` (`Africa/Cairo`), `SEED_ADMIN_EMAIL`,
    `SEED_ADMIN_PASSWORD` (one-time bootstrap script only).
  - **Atlas**: M0 cluster (`maxPoolSize: 20, minPoolSize: 2` on the single Railway replica, well within M0's 500-connection limit), DB user with readWrite on app DB, network access for Railway egress
    (0.0.0.0/0 with strong credentials, as Railway has no static egress IP on lower tiers).
  - **Bootstrap**: `npm --workspace server run seed:admin` creates the University and first
    University Admin with `mustChangePassword: true`.
- **Rationale**: Matches requested hosting and env vars; optional vars have safe defaults.
- **Alternatives**: Docker deploy (unneeded; Nixpacks handles Node).

## R-22 — Progress and grading calculators (pure functions)

- **Decision**:
  - `computeProgress(phases)`: Σ over phases of exact `weight × approvedRequired / totalRequired` (no intermediate rounding);
    phases with `totalRequired = 0` contribute `weight` iff `completedBySupervisor`; latest
    submission status per deliverable decides "approved"; final sum rounded once via `Math.round(raw * 10) / 10` (clamped `[0, 100]`, so fully approved phases equal exact `100`); returns
    `{percent, perPhase[]}`. Recomputed synchronously in the review transaction and stored on
    `projects.progress` (FR-056 "immediately").
  - `computeEvaluatorTotal(rubric, teamScores, individualScores[studentId])` → 0–100 (all criteria `maxScore = 100`).
  - `computeStudentFinal({supervisorPct, committeePct, supervisorTotal, committeeTotals[]})` =
    `supervisorPct × supervisorTotal + committeePct × mean(committeeTotals)`, rounded to 2
    decimals (`Math.round(raw * 100) / 100`) **before** evaluating `passed = final >= passMark` and `gradeBand(final, passMark)` (display 1 decimal).
  - `computeTeamGrade` normalizes Team-tagged criteria weights to `0–100` (`(Σ teamScore × weight) / Σ teamWeights × 100`) with the same supervisor/committee split (`null` if zero Team-tagged criteria).
  - `spreadExceeded(committeeTotals, threshold=15)`: strict `max - min > threshold` per student (`false` when committee has 1 examiner); `gradeBand(grade, passMark)` → band key.
  - Validation helpers: weights sum to 100 (± 0.001 tolerance), split sums to 100.
- **Rationale**: SC-007 requires exact agreement with manual calculation; pure functions in
  `shared` let the client preview with the same math.
- **Alternatives**: Computing in aggregation pipelines (harder to unit-test).
