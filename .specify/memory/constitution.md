<!--
Sync Impact Report
==================
Version change: (unversioned template) → 1.0.0
Bump rationale: Initial ratification — all placeholders replaced with concrete governance.

Modified principles (template placeholder → new title):
  - [PRINCIPLE_1_NAME] → I. Arabic-Only Interface (NON-NEGOTIABLE)
  - [PRINCIPLE_2_NAME] → II. Role-Based Access & Data Isolation (NON-NEGOTIABLE)
  - [PRINCIPLE_3_NAME] → III. Security & Privacy
  - [PRINCIPLE_4_NAME] → IV. Traceability
  - [PRINCIPLE_5_NAME] → V. Test-First Quality
Added principles:
  - VI. Simplicity & Modularity
  - VII. Accessibility & Responsiveness
  - VIII. Performance
  - IX. Free-Tier Friendly
Added sections:
  - Technology & Deployment Constraints (was [SECTION_2_NAME])
  - Development Workflow & Quality Gates (was [SECTION_3_NAME])
  - Governance (filled)
Removed sections: none

Templates reviewed (read at runtime; not modified by this command):
  - .specify/templates/plan-template.md      — "Constitution Check" gate must reference Principles I–IX
  - .specify/templates/spec-template.md      — no change required
  - .specify/templates/tasks-template.md     — test-first ordering aligns with Principle V

Deferred TODOs: none
-->

# منصة مشاريع الطلاب (Student Projects Platform) Constitution

**Scope**: A web platform for a single university that manages graduation projects for ALL of its
colleges — from team registration and proposal through tracking, submission, defense and
evaluation — plus a public showcase where each published project has its own mini-site for public
voting and for discovery by industry partners and investors.

## Core Principles

### I. Arabic-Only Interface (NON-NEGOTIABLE)

- The entire user interface MUST be in Arabic only. There MUST NOT be any English UI text and
  there MUST NOT be a language switcher.
- The root document MUST set `lang="ar"` and `dir="rtl"`; all layouts MUST render right-to-left.
- The primary UI font MUST be **Cairo**, with a system Arabic fallback stack.
- All UI strings (labels, buttons, headings, toasts, empty states, emails, validation and error
  messages) MUST live in a single Arabic text resource file. Hard-coded user-facing strings in
  components or server responses are prohibited; lint or review MUST reject them.
- Dates, times and numbers MUST be formatted for Arabic (e.g., `Intl` with an `ar` locale).
  Server-side validation errors returned to the client MUST map to Arabic messages from the same
  resource.
- Code identifiers, commit messages, logs and developer documentation MAY be in English.

**Rationale**: The platform serves an Arabic-speaking university; one consistent language and a
single string source prevent mixed-language UI and make wording reviewable in one place.

### II. Role-Based Access & Data Isolation (NON-NEGOTIABLE)

- Every API request (except explicitly public showcase and auth endpoints) MUST pass through ONE
  central authorization middleware that checks BOTH the caller's **role** AND **scope**.
- The scope hierarchy is: **University > College > Department > Project/Team**. A user's access
  MUST be limited to the nodes they are assigned to and their descendants.
- Route handlers and services MUST NOT implement ad-hoc permission logic outside the central
  policy; data queries MUST be constrained by the resolved scope (no fetch-then-filter of
  out-of-scope data).
- Users MUST NEVER read or modify data outside their scope; denied access MUST return a uniform
  error that does not leak the existence of the resource.
- Public data is ONLY what a team has explicitly published to the showcase. Unpublished content
  MUST never be served by public endpoints.

**Rationale**: Multi-college data isolation is the core trust guarantee; a single enforcement point
makes it auditable and testable.

### III. Security & Privacy

- Passwords MUST be hashed with bcrypt; plaintext or reversible storage is prohibited.
- Authentication MUST use short-lived JWT access tokens plus refresh tokens stored in `httpOnly`,
  `Secure`, `SameSite` cookies, with refresh-token rotation and revocation on logout.
- Every input MUST be validated server-side (shared schemas, Principle VI) regardless of
  client-side validation.
- Rate limiting MUST protect auth, voting and write endpoints. Request payloads MUST be sanitized
  against NoSQL operator injection (e.g., `$`/`.` keys).
- File uploads MUST go to Cloudinary via server-signed upload parameters with type and size limits
  enforced; unsigned uploads are prohibited.
- Approvals, grading, re-evaluations, role/scope changes and all admin actions MUST write an audit
  log entry (actor, action, target, timestamp, before/after where applicable).
- Student personal contact information (email, phone, etc.) MUST NOT be public by default and MAY
  only be exposed by explicit opt-in of that student.

**Rationale**: The platform holds academic records and personal data; these controls are the
minimum baseline for a public-facing university system.

### IV. Traceability

- Proposal changes, submissions, reviews and grades MUST be versioned: each change creates a new
  record/version with author identity and timestamp; prior versions MUST remain retrievable.
- Once a grade is **finalized** it MUST be immutable. Any change MUST go through an audited
  re-evaluation flow that records requester, approver, reason, old value and new value.
- Hard deletion of versioned academic records is prohibited; use soft-delete/archival states.

**Rationale**: Grades and approvals may be disputed; a full who-did-what-when history is required
to resolve disputes fairly.

### V. Test-First Quality

- Business rules — permissions/scope checks, progress percentage calculation, grading math,
  voting limits and state transitions — MUST have automated tests written BEFORE the
  implementation (Red → Green → Refactor).
- Critical user journeys (e.g., registration → proposal approval → submission → defense →
  grading → publishing → public voting) MUST have end-to-end tests.
- Every authorization rule MUST have at least one positive and one negative (out-of-scope) test.
- A pull request that adds or changes a business rule without corresponding tests MUST NOT be
  merged.

**Rationale**: Errors in permissions or grades are high-impact and hard to notice manually; tests
written first define the rule precisely.

### VI. Simplicity & Modularity

- The codebase MUST be a MERN monorepo with three workspaces: `client`, `server`, `shared`.
- The server MUST be a modular monolith with one folder per domain module: `auth`,
  `organization`, `projects`, `tracking`, `collaboration`, `evaluation`, `showcase`, `reports`.
  Modules MUST interact through their public service interfaces, not each other's models directly.
- Validation schemas MUST be defined once in `shared` and used by both client and server.
- YAGNI: no microservices, no speculative abstractions, no features beyond the current spec.
  Added complexity MUST be justified in the plan's Complexity Tracking section.

**Rationale**: A small team on free-tier hosting benefits most from one deployable backend with
clear internal boundaries.

### VII. Accessibility & Responsiveness

- UI MUST be designed mobile-first and be fully usable from 360px width upward.
- UI MUST meet WCAG 2.1 Level AA (contrast, keyboard navigation, focus visibility, labels,
  ARIA where needed).
- All components MUST behave correctly in RTL: mirrored layout and directional icons, logical CSS
  properties (`margin-inline-start`, etc.), correct ordering in tables, forms, carousels and
  pagination.

**Rationale**: Students, staff and visitors primarily use phones; accessibility is a legal and
ethical baseline.

### VIII. Performance

- Pages MUST load (Largest Contentful Paint) in under 2 seconds on a typical 4G connection.
- Every MongoDB query pattern used in production MUST be supported by an appropriate index;
  collection scans on hot paths are prohibited.
- Reports and dashboards MUST use MongoDB aggregation pipelines, not in-application loops over
  full collections.
- All list endpoints MUST be paginated with an enforced maximum page size.

**Rationale**: Free-tier resources are limited; efficient queries and small payloads keep the
platform fast under peak periods such as defense season and public voting.

### IX. Free-Tier Friendly

- The system MUST run on: MongoDB Atlas (free tier), Cloudinary free plan, Vercel (frontend) and
  Railway (backend).
- Cloudinary MUST store only images and small files; long videos MUST be referenced as
  YouTube or Google Drive links, not uploaded.
- Designs MUST respect free-tier limits (storage, bandwidth, connections); any feature requiring
  a paid tier MUST be flagged and justified in its plan.

**Rationale**: The university project must be operable at zero or near-zero hosting cost.

## Technology & Deployment Constraints

- **Stack**: MongoDB (Atlas) + Express + React + Node.js, organized as a monorepo
  (`client` / `server` / `shared`).
- **Hosting**: Frontend on Vercel; backend API on Railway; database on MongoDB Atlas; media on
  Cloudinary.
- **Secrets**: All secrets and credentials (DB URIs, JWT secrets, Cloudinary keys) MUST be
  provided via environment variables only and MUST NEVER be committed. A `.env.example` with
  placeholder values MUST be maintained.
- **Localization**: Arabic is the only UI locale (Principle I); no i18n framework for multiple
  locales is required beyond the single Arabic resource file.
- **Showcase**: Each published project exposes a public mini-site; public endpoints are read-only
  except rate-limited voting.

## Development Workflow & Quality Gates

- All work MUST happen on Git feature branches; direct commits to the main branch are prohibited.
- Every change MUST be merged via a pull request with at least one code review approval.
- Lint and the full automated test suite MUST pass in CI before merge.
- Commits MUST follow the Conventional Commits format (`feat:`, `fix:`, `docs:`, `test:`,
  `refactor:`, `chore:` …).
- Reviewers MUST verify compliance with this constitution, in particular: no hard-coded UI
  strings (I), use of the central authorization middleware (II), tests for business rules (V),
  and indexes/pagination for new queries (VIII).

## Governance

- This constitution supersedes all other practices and guidelines for this project. When a
  conflict arises, this document wins.
- Amendments MUST be proposed via pull request that edits `.specify/memory/constitution.md`,
  states the rationale, includes an updated Sync Impact Report, and describes any migration
  needed for existing code.
- Versioning follows semantic versioning:
  - **MAJOR**: removal or backward-incompatible redefinition of a principle or governance rule.
  - **MINOR**: a new principle/section or materially expanded guidance.
  - **PATCH**: clarifications, wording or typo fixes without semantic change.
- Every feature plan MUST pass the "Constitution Check" gate against Principles I–IX before
  design and again after design; violations MUST be justified in Complexity Tracking or removed.
- NON-NEGOTIABLE principles (I and II) MUST NOT be waived by any plan or review.

**Version**: 1.0.0 | **Ratified**: 2026-11-23 | **Last Amended**: 2026-11-23
