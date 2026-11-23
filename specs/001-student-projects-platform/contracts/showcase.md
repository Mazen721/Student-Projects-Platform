# Contract: showcase module

Schemas: `shared/src/schemas/showcase.js`. State machine: `shared/src/machines/showcaseMachine.js`.

## Public endpoints (no auth; read-only except page-view beacon)

All public responses are built from an explicit **allow-list projection** of published data
(FR-100a: `components[]` are names only without prices/suppliers/totals; `gallery` includes only `visibility: 'public'` items; deactivated/removed impostors under `FR-013a` are stripped immediately). Unpublished, taken-down, or unknown slugs return `404 NOT_FOUND` with
`ar.showcase.unavailable` ("هذا المشروع غير متاح حالياً") (US6-7). Detail endpoint `/public/projects/:slug` uses `Cache-Control: no-store` so privacy opt-outs, unpublishes, and takedowns take effect immediately; listing endpoints `/public/home` and `/public/colleges` use `Cache-Control: public, max-age=30, must-revalidate`.

| Method | Path | Query | Success |
|---|---|---|---|
| GET | `/public/home` | — | `{featured[], trending[], mostVoted[], colleges[]}` (FR-103) |
| GET | `/public/projects` | `{q, collegeId, departmentId, field, academicYearId, type, sort: trending|votes|recent, page, limit}` | paginated public cards |
| GET | `/public/projects/:slug` | — | mini-site: template, theme, visible sections, public gallery, video embed, team `{name, avatar, sharedContacts}` (opt-in only), supervisor name, college, achievements, `voteCount`, viewer flags (`hasVoted`, `canVote` when a token is present) |
| POST | `/public/projects/:slug/view` | — | 204 (deduped per visitor per day) |
| GET | `/public/colleges/:id/showcase` | `{page, limit, sort}` | college showcase page |
| GET | `/public/projects/:slug/comments` | `{page, limit}` | visible comments |
| GET | `/public/competitions` / `/public/competitions/:id` | — | competitions + live/frozen ranking |
| GET | `/public/colleges` / `/public/university` | — | names, logos only |

## Team-side page management

| Method | Path | authorize | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/projects/:id/showcase` | `authorize('showcase.edit','project')` | — | full editable page + state | — |
| PUT | `/projects/:id/showcase` | `authorize('showcase.edit','project')` (team) | `showcasePageSchema {template, theme, sections{…}, hiddenSections[]}` | 200; if `published` & `everApproved` → live immediately | — |
| GET | `/projects/:id/showcase/preview` | `authorize('showcase.edit','project')` | — | same shape as public payload | — |
| POST | `/projects/:id/showcase/transitions` | `authorize('showcase.transition','project')` + machine roles | `{event: REQUEST_PUBLISH|APPROVE|REJECT_PUBLISH|UNPUBLISH|PUBLISH|TAKE_DOWN, reason?}` | 200 | `BUSINESS_RULE: PROJECT_NOT_APPROVED`; `reason` required for TAKE_DOWN/REJECT_PUBLISH (audited) |

## Voting & competitions

| Method | Path | authorize | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/projects/:id/vote` | `authorize('vote.cast','publishedProject')` + vote rate limiter | — | 201 `{status: valid|flagged, voteCount}` | `ALREADY_VOTED` (US6-4), `BUSINESS_RULE: VOTE_ACCOUNT_TOO_NEW` (`vars.availableAt`, US6-5), `SELF_VOTE`, `RATE_LIMITED` |
| DELETE | `/projects/:id/vote` | `authorize('vote.withdraw','publishedProject')` | — | 204 | — |
| POST | `/competitions` | `authorize('competition.create','scope')` (university/college admin) | `competitionSchema {title, scopeType, scopeId?, eligibleProjectIds[]|rule, voterRestriction, startsAt, endsAt}` | 201 | — |
| POST | `/competitions/:id/projects/:projectId/vote` | `authorize('vote.cast','competition')` | — | 201 (isolated to `competitionvotes`; does not affect general `validVotes`/trending; withdrawal blocked after `endsAt`) | `BUSINESS_RULE: COMPETITION_CLOSED` (US6-8), `VOTER_NOT_UNIVERSITY` |
| GET | `/votes/flagged` | `authorize('vote.review','scope')` | page | flagged votes | — |
| POST | `/votes/:id/review` | `authorize('vote.review','vote')` | `{decision: clear|reject}` | 200 (audited; counts adjusted) | — |
| PUT | `/university/featured` | `authorize('showcase.feature','university')` | `{projectIds[]}` | 200 | — |

## Investors

| Method | Path | authorize | Body | Success | Errors |
|---|---|---|---|---|---|
| POST/DELETE | `/projects/:id/follow` | `authorize('investor.follow','publishedProject')` (approved investor) | — | 201/204 | `ACCOUNT_PENDING` |
| POST/DELETE | `/projects/:id/bookmark` | `authorize('investor.bookmark','publishedProject')` | — | 201/204 | — |
| GET | `/me/follows`, `/me/bookmarks` | `authorize('self.read','user')` | page | lists | — |
| POST | `/projects/:id/contact-requests` | `authorize('contact.request','publishedProject')` | `{message}` | 201 | — |
| GET | `/projects/:id/contact-requests` | `authorize('contact.list','project')` (team; leader decides) | page | list | — |
| POST | `/contact-requests/:id/decide` | `authorize('contact.decide','contactRequest')` (**leader only**) | `{decision: accept|decline, reply?{text, sharedContacts{email?, phone?, other?}}}` | 200; bounded to leader's explicitly entered/selected contact fields (never auto-exposes teammates); previously accepted replies remain readable in `/me/contact-requests` while new requests require `published` state (US6-6) | — |
| GET | `/me/contact-requests` | `authorize('self.read','user')` | page | investor's requests + replies | — |
| GET/POST | `/challenges` | `authorize('challenge.list','self')` / `authorize('challenge.create','self')` (approved investor) | `challengeSchema {title, description, field}` | list / 201 | — |
| POST | `/challenges/:id/remove` | `authorize('challenge.remove','challenge')` (admin) | `{reason}` | 200 (audited) | — |

## Public comments

| Method | Path | authorize | Body | Success |
|---|---|---|---|---|
| POST | `/projects/:id/public-comments` | `authorize('publicComment.create','publishedProject')` (active logged-in user) + write limiter | `{text, parentId?}` (replies by team members) | 201 |
| POST | `/public-comments/:id/report` | `authorize('publicComment.report','publicComment')` | `{reason}` | 201 |
| POST | `/public-comments/:id/moderate` | `authorize('publicComment.moderate','publicComment')` (team or admin) | `{action: hide|remove|restore, reason?}` | 200 (admin actions audited) |
