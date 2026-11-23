# API Contracts — Conventions

**Feature**: `001-student-projects-platform` | See also [data-model.md](../data-model.md), [research.md](../research.md)

## Base

- REST base URL: `${VITE_API_URL}/api/v1` (server on Railway). Health: `GET /api/health` (public).
- Socket.IO: `${VITE_API_URL}` path `/socket.io` — see [socket-events.md](./socket-events.md).
- JSON only (except Excel import `multipart/form-data` and export downloads).
- Request/response schemas are the Zod schemas in `shared/src/schemas/<module>.js`; names in the
  tables below (e.g. `createProposalSchema`) refer to those exports.

## Authentication

- `Authorization: Bearer <accessToken>` on all non-public endpoints.
- Refresh cookie `spp_rt` (`HttpOnly; Secure; SameSite=None; Path=/api/v1/auth`) is used only by
  `/auth/refresh` and `/auth/logout`, which also require header `X-Requested-With: spp`.
- `X-Role-Context: <roleAssignmentId>` (optional) restricts list/dashboard results to one role.

## Authorization column

Each endpoint lists the `authorize(action, resource)` call. `public` = explicitly public route
(`publicRoute()`); `auth` = any authenticated active user (still passes `authorize('self.*')`).
Rules for each action live in `server/src/core/authz/policies.js`; the authz matrix test
generates one in-scope ✅ and one out-of-scope ❌ case per action.

## Response envelope

Success (single): `{ "data": { ... } }`
Success (list): `{ "data": [ ... ], "page": { "page": 1, "limit": 20, "total": 134, "pages": 7 } }`
Error: `{ "error": { "code": "VALIDATION_ERROR", "message": "<Arabic>", "fields": [ { "path": "title", "code": "validation.minLength", "message": "<Arabic>" } ] } }`

`message` values come from `ar.errors[code]` / `ar.validation[code]` in `shared/src/locales/ar.js`.

## Pagination & filtering

- Query: `page` (≥1, default 1), `limit` (1–100, default 20; chat cursor `≤ 50`), `sort` (whitelisted per endpoint,
  e.g. `-createdAt`, always suffixed with `,_id` as deterministic tie-breaker), plus endpoint filters. Invalid `page < 1`, `limit > 100`, non-whitelisted `sort`, or malformed `ObjectId` fail fast with `400 VALIDATION_ERROR`.
- Filters are always AND-ed with the caller's `scopeFilter` server-side.
- Access denials: ID-addressed or scope-targeted lookups return `404 NOT_FOUND` (`ar.errors.NOT_FOUND` = "غير مصرح أو غير موجود") to avoid leaking existence; collection-level actions without target IDs return `403 FORBIDDEN` (`ar.errors.FORBIDDEN` = "غير مصرح").
- Full `SC-004` zero-leakage matrix tests cover REST routes, Socket.IO events, upload signing (`/uploads/sign`), and report exports (`?format=xlsx|pdf`).

## Standard error codes

| HTTP | code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod failure; `fields[]` populated |
| 400 | `INVALID_TRANSITION` | State machine forbids event from current state |
| 401 | `UNAUTHENTICATED` / `TOKEN_EXPIRED` / `INVALID_CREDENTIALS` | |
| 403 | `FORBIDDEN` | Collection-level action not allowed ("غير مصرح") |
| 403 | `PASSWORD_CHANGE_REQUIRED` | Temp password; only change-password allowed |
| 403 | `ACCOUNT_PENDING` / `ACCOUNT_DEACTIVATED` | |
| 404 | `NOT_FOUND` | Missing **or out of scope** (no existence leak) |
| 409 | `DUPLICATE_EMAIL` / `DUPLICATE_STUDENT_ID` / `ALREADY_VOTED` / `CONFLICT` | |
| 409 | `WINDOW_CLOSED` | Registration/proposal/re-eval window closed (`vars` include dates) |
| 409 | `GRADE_LOCKED` | Finalized grade edit attempt |
| 422 | `BUSINESS_RULE` | Specific sub-code in `error.rule`, e.g. `TEAM_FULL`, `TEAM_BELOW_MIN`, `SUPERVISOR_AT_CAPACITY`, `NOT_ELIGIBLE_FOR_DEFENSE`, `COI_VIOLATION`, `VOTE_ACCOUNT_TOO_NEW`, `SELF_VOTE`, `COMPETITION_CLOSED` |
| 429 | `RATE_LIMITED` | |
| 500 | `INTERNAL_ERROR` | No stack/details in production |

## Files

| File | Module |
|---|---|
| [auth.md](./auth.md) | auth |
| [organization.md](./organization.md) | organization |
| [projects.md](./projects.md) | projects |
| [tracking.md](./tracking.md) | tracking |
| [collaboration.md](./collaboration.md) | collaboration |
| [evaluation.md](./evaluation.md) | evaluation |
| [showcase.md](./showcase.md) | showcase (incl. public endpoints) |
| [reports.md](./reports.md) | reports |
| [uploads.md](./uploads.md) | core/uploads |
| [socket-events.md](./socket-events.md) | realtime |
