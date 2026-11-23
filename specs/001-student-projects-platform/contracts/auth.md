# Contract: auth module

Schemas: `shared/src/schemas/auth.js`. Rate limit `auth` (10 / 15 min per IP+email) on login,
sign-up and invite acceptance.

| Method | Path | authorize | Body / Query | Success | Notable errors |
|---|---|---|---|---|---|
| POST | `/auth/register/student` | public | `registerStudentSchema {name, email, studentId, password, collegeId, departmentId}` | 201 `{accessToken, user}` + sets `spp_rt` | `DUPLICATE_EMAIL`, `DUPLICATE_STUDENT_ID`, `VALIDATION_ERROR` (`validation.emailDomain`) — intentionally identifies duplicate field per FR-013/US1-4 |
| POST | `/auth/register/investor` | public | `registerInvestorSchema {name, organization, email, password, fieldOfInterest}` | 201 `{accessToken, user{status:'pending'}}` | `DUPLICATE_EMAIL` |
| POST | `/auth/register/visitor` | public | `registerVisitorSchema {name, email, password}` | 201 `{accessToken, user}` | `DUPLICATE_EMAIL` |
| POST | `/auth/login` | public | `loginSchema {email, password}` | 200 `{accessToken, user, mustChangePassword}` | `INVALID_CREDENTIALS` (always generic), `ACCOUNT_DEACTIVATED` |
| POST | `/auth/refresh` | public (cookie + `X-Requested-With`) | — | 200 `{accessToken, user}`; rotates cookie | `UNAUTHENTICATED` (reuse → family revoked) |
| POST | `/auth/logout` | public (cookie + `X-Requested-With`) | — | 204; clears cookie | — |
| POST | `/auth/change-password` | `authorize('self.changePassword','user')` | `changePasswordSchema {currentPassword?, newPassword}` | 200 `{accessToken}` | `INVALID_CREDENTIALS` (only endpoint + `/auth/me` + `/auth/logout` allowed when `mustChangePassword: true`) |
| GET | `/auth/me` | `authorize('self.read','user')` | — | `{user, roles[], activeRoleId}` | — |
| GET | `/invitations/:token` | public | — | `{kind, role, scopeLabel, expiresAt}` | uniform `NOT_FOUND` / `INVITE_UNAVAILABLE` (does not leak used vs. unknown) |
| POST | `/invitations/:token/accept` | public (or auth for existing user) | `acceptInviteSchema {name?, password?}` | 200 `{accessToken, user}` | atomic single-use check; uniform `INVITE_UNAVAILABLE` |

## Users & profile (auth module)

| Method | Path | authorize | Body / Query | Success |
|---|---|---|---|---|
| GET | `/users/me/profile` | `self.read` | — | profile incl. privacy |
| PATCH | `/users/me/profile` | `self.update` | `updateProfileSchema {bio, skills[], phone, socialLinks[], avatar FileRefInput, privacy{email,phone,socialLinks}}` | updated profile |
| GET | `/users/:id` | `authorize('user.read','user')` | — | profile with private fields stripped unless viewer is self or authorized admin |
| GET | `/users` | `authorize('user.list','scope')` | `listUsersQuery {q, role, collegeId, departmentId, status, page, limit}` | paginated (scope-filtered) |
| GET | `/users/search` | `authorize('user.searchForTeam','scope')` | `{q, collegeId?}` | minimal `{id, name, avatar, department}` for team invites |
| POST | `/users/:id/deactivate` | `authorize('user.deactivate','user')` | `{reason, releaseIdentifiers?: bool}` | 200 (audited; FR-013a, FR-021; when `releaseIdentifiers: true`, cascades to remove project memberships & invalidate votes) |
| POST | `/users/:id/reactivate` | `authorize('user.reactivate','user')` | `{reason?}` | 200 (audited) |
| POST | `/users/:id/reset-password` | `authorize('user.resetPassword','user')` | — | 200 `{temporaryPassword}` shown once (audited; FR-015) |
| POST | `/users/:id/roles` | `authorize('role.assign','user')` | `assignRoleSchema {role, scopeType, scopeId}` | 201 (audited; delegation ceiling enforced: target role & scope must be strictly below or within actor's matching admin scope; `collegeAdmin` cannot grant `universityAdmin`/`collegeAdmin`, `departmentAdmin` cannot grant admin roles) |
| DELETE | `/users/:id/roles/:assignmentId` | `authorize('role.revoke','user')` | `{reason}` | 204 (audited; triggers immediate `tokenVersion` bump) |
| POST | `/invitations` | `authorize('invitation.create','scope')` | `createInvitationSchema {role, scopeType, scopeId}` | 201 `{url, expiresAt}` (7 days, 256-bit token, single-use) |
| POST | `/invitations/:id/revoke` | `authorize('invitation.revoke','invitation')` | `{reason?}` | 200 (audited) |
| GET | `/investors/pending` | `authorize('investor.review','university')` | page | paginated |
| POST | `/investors/:id/approve` | `authorize('investor.review','university')` | — | 200 (audited) |
| POST | `/investors/:id/reject` | `authorize('investor.review','university')` | `{reason?}` | 200 (audited; reason shown to investor) |
