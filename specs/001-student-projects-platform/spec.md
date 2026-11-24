# Feature Specification: منصة مشاريع الطلاب (Student Projects Platform)

**Feature Branch**: `001-student-projects-platform`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Build منصة مشاريع الطلاب (Student Projects Platform) for a single university:
a platform that manages graduation projects for all colleges of the university from registration
through planning, execution, tracking, defense and evaluation; a public showcase where every
project has its own mini-site for voting, industry and investors; and management dashboards. The
entire interface is Arabic only (RTL). Prioritized stories: P1 Accounts, Roles & University
Structure; P2 Project Registration, Teams & Supervisor Assignment; P3 Phases, Deliverables,
Components & Progress Tracking; P4 Communication, Chat & Media; P5 Defense & Evaluation; P6 Public
Showcase (Mini-site per Project), Voting & Investors; P7 Dashboards & Reports."

## Clarifications

### Session 2026-11-23

- Q: How should student sign-up guard against someone registering with another student's email or
  student ID, given no email verification and no admin approval? → A: University email domain check
  only; no roster matching. Misuse is handled reactively by admins (deactivate the impostor account
  and free the email/student ID).
- Q: A student is limited to one active project per year. When can they start or join a different
  project in the same academic year? → A: Free again if the proposal is Rejected/withdrawn or if
  they leave/are removed before Approval; after Approval they are locked to that project for the
  year unless an admin moves or removes them.
- Q: When a cross-college team is formed, how should rules, approval, and data visibility work for
  the colleges of non-leader members? → A: Leader's college owns rules, workflow, and approval;
  non-leader members' college/department admins get read-only access to the project summary, status,
  and their student's final grade.
- Q: How should a supervisor's maximum project limit be counted, and can an admin override it in
  exceptional cases? → A: Primary supervision only counts toward the cap (co-supervision excluded
  from the cap); blocked by default, with an audited override allowed for College Admins (mandatory
  reason).
- Q: Who has final authority to approve, reject, or request changes on a submitted project
  proposal? → A: Two-step approval: a supervisor reviews first (requests changes or submits a
  recommendation), then the Department Admin (or College Admin within scope) issues the final
  Approved or Rejected decision.
- Q: How should a project's automatic completion percentage be calculated from its phases,
  deliverables, milestones, and tasks? → A: Proportional by approved required deliverables only
  (`phase weight × approved ÷ total` per phase; a phase with 0 required deliverables earns its
  weight when marked complete by the supervisor); milestones and Kanban tasks do not affect %.
- Q: How should the grading formula combine the supervisor/committee split with team grades and
  individual student grades? → A: Additive team + individual criteria: each rubric criterion is
  tagged Team or Individual (weights sum to 100%); each student's final grade = `(Supervisor % ×
  student's supervisor total) + (Committee % × average of committee examiners' totals for that
  student)`.
- Q: What should happen when committee examiners submit sharply different grades for the same
  project or student? → A: Flag when the spread exceeds a college-configured threshold (default 15
  points); the chair can unlock scores for deliberation revision (versioned) or finalize as-is with
  a mandatory note.
- Q: Once a grade is finalized and locked, who can request a re-evaluation, within what window, and
  who enters the revised grade if approved? → A: A student or supervisor may submit at most 1
  request within a college-configured window after finalization (default 7 days) with a written
  reason; if the College Admin approves, grading reopens for the original or a replacement
  committee to submit revised versioned scores and re-finalize (fully audited).
- Q: After a grade is finalized, how much grade detail should a student be able to view? → A:
  Student sees their own final grade, pass/fail status, aggregated rubric breakdown (supervisor
  score and averaged committee score per criterion), and committee recommendations/modifications;
  individual examiner scores and teammates' individual grades are hidden.
- Q: Once a project's mini-site is published, what information should be public by default and what
  should stay private unless explicitly opted in (or never shown)? → A: Core showcase sections
  (cover, slogan, problem/solution, features, technologies, component names without prices, public
  gallery, video embed, team names/avatars, supervisor name, college, achievements) are public by
  default when published; grades, internal deliverables, BOM prices/budget, and student contacts
  remain private (contacts only if individually opted in).
- Q: When can a team first request to publish its mini-site, and when is re-approval required after
  initial publication? → A: Any Approved project may request first publication (supervisor approves);
  subsequent routine edits go live directly, while re-publishing after a supervisor or admin
  takedown requires approval again (audited).
- Q: Who should be allowed to vote on showcase projects, and how should suspicious votes be handled
  when no email verification exists? → A: All active logged-in users except the project's own team
  and assigned supervisors/mentors; enforces min account age (default 24h) + per-account/per-IP
  rate limits; suspicious burst votes are flagged and excluded from live counts unless cleared by an
  admin; competitions may optionally restrict voting to university accounts only.
- Q: How should investor approval, project contact requests, and investor-published challenges work
  end-to-end? → A: University Admin approves/rejects investor accounts (with reason, audited);
  approved investors publish challenges/ideas directly (removable by admins); only the Team Leader
  accepts/declines contact requests and shares only contact details explicitly entered/selected in
  the acceptance reply.
- Q: How should dashboard and report metrics be defined — especially evaluation statistics and
  which projects count in completion/load/trending metrics? → A: Completion %, supervisor primary
  load, unassigned count, budgets, and late-submission rates include Approved projects in the
  selected year; evaluation statistics aggregate per student over finalized grades using standard
  Arabic bands (`امتياز ≥85%`, `جيد جداً 75–<85%`, `جيد 65–<75%`, `مقبول passMark–<65%`, `راسب
  <passMark`); trending = `valid votes (7d) × 3 + unique views (7d)`.

## User Scenarios & Testing *(mandatory)*

> All screens, messages, dates and numbers described below are presented in Arabic, right-to-left
> (constitution Principle I). "Scope" always means the University > College > Department >
> Project/Team hierarchy (constitution Principle II).

### User Story 1 - Accounts, Roles & University Structure (Priority: P1)

The University Admin sets up the university structure (colleges and departments) and appoints
college admins. Each college configures its academic years, semesters and project-cycle deadlines.
Students self-register with their university email and student ID and start using the platform
immediately. Supervisors and admins join through invite links. Industry/investor users
self-register and wait for University Admin approval. Visitors create light accounts so they can
vote. Every user lands on a home dashboard matching their role(s), and admins manage users within
their scope with all important actions written to an audit log.

**Why this priority**: Every other story depends on identity, roles, scope and the organizational
structure. Without it nothing can be authorized or isolated.

**Independent Test**: Create a university with two colleges and departments, configure a cycle,
register a student, invite a supervisor, register and approve an investor, bulk-import students
from an Excel file, and verify each user sees only their own role dashboard and in-scope data.

**Acceptance Scenarios**:

1. **Given** a University Admin is logged in, **When** they create a college "كلية الهندسة" and a
   department under it, **Then** both appear in the structure and the action is recorded in the
   audit log.
2. **Given** a College Admin of college A, **When** they try to edit a department of college B,
   **Then** the request is denied with a generic "غير مصرح" message and no data of college B is
   revealed.
3. **Given** an unregistered student, **When** they sign up with a unique university email, student
   ID, college and department, **Then** the account is active immediately and they land on the
   student dashboard.
4. **Given** an email or student ID that already exists, **When** someone signs up with it, **Then**
   sign-up is rejected with an Arabic error identifying the duplicate field.
5. **Given** a student forgot their password, **When** the college admin resets it, **Then** a
   temporary password is shown once to the admin, and the student must change it at next login.
6. **Given** a College Admin, **When** they generate an invite link for a supervisor, **Then** the
   recipient can open the link, set a password, and gets the Supervisor role scoped to that
   college/department; the link stops working after use or expiry.
7. **Given** an industry user self-registers, **When** they log in before approval, **Then** they
   see a "قيد المراجعة" status and cannot access investor features until the University Admin
   approves them.
8. **Given** a College Admin uploads an Excel file of 200 students with 3 invalid rows, **When**
   the import runs, **Then** 197 accounts are created, and a row-by-row Arabic error report lists
   the 3 rejected rows with reasons.
9. **Given** a user holds both Supervisor (department X) and Department Admin (department X)
   roles, **When** they log in, **Then** they can switch between both role dashboards and each
   shows only data within that role's scope.
10. **Given** a student sets their phone number to private, **When** anyone views their profile,
    **Then** the phone number is not shown.

---

### User Story 2 - Project Registration, Teams & Supervisor Assignment (Priority: P2)

A student becomes team leader by creating a project proposal, invites teammates (by search or link),
and submits the proposal for review within the college's registration window. Reviewers move it
through the proposal workflow with comments. Students state a preferred supervisor; the admin
assigns a supervisor (and optionally a co-supervisor / industry mentor) respecting capacity limits.
Supervisors and industry partners publish ideas in an ideas bank that teams can request to adopt.

**Why this priority**: Projects and teams are the core object of the platform; tracking,
evaluation and showcase all require an approved project with a team and supervisor.

**Independent Test**: As a student, create a proposal, form a team within size limits, submit,
receive "Needs Changes", resubmit, get approved, and be assigned a supervisor; verify full history
and per-role project lists.

**Acceptance Scenarios**:

1. **Given** the registration window is open, **When** a student creates a proposal with all
   required fields, **Then** it is saved as "مسودة" (Draft) and the student becomes Team Leader.
2. **Given** a proposal title similar to an existing project title, **When** the leader types or
   saves it, **Then** a warning lists the similar titles, but saving is still allowed.
3. **Given** the college max team size is 4 and the team has 4 members, **When** the leader
   invites a fifth, **Then** the invitation is blocked with an Arabic message.
4. **Given** a team is below the minimum size, **When** the leader submits, **Then** submission is
   blocked until the minimum is met.
5. **Given** a submitted proposal, **When** the reviewing supervisor selects "يحتاج تعديلات" with
   comments, **Then** the team is notified in-app, can edit, and resubmit; once the supervisor
   submits a recommendation, the Department Admin issues the final "مقبول" or "مرفوض" decision,
   and every status change and edit is kept in history with actor and time.
6. **Given** a supervisor already has the maximum number of primary-supervised projects, **When** a
   Department Admin tries to assign another, **Then** the assignment is blocked and the load view
   shows them as full; a College Admin may override only by entering a mandatory reason that is
   recorded in the audit log.
7. **Given** a supervisor published an idea in the ideas bank, **When** a team requests to adopt
   it and the supervisor accepts, **Then** the proposal is pre-filled from the idea and the idea is
   marked as taken.
8. **Given** the registration window is closed, **When** a student tries to create a proposal,
   **Then** creation is blocked with the window dates shown.
9. **Given** the leader transfers leadership to a member who accepts, **Then** roles swap and the
   change is recorded in the project history.

---

### User Story 3 - Phases, Deliverables, Components & Progress Tracking (Priority: P3)

Colleges define phase templates with weights, due dates and official downloadable forms (نماذج).
Each approved project receives its own copy of the phases, which the supervisor may adjust. Teams
submit versioned deliverables; supervisors review them. Teams manage a Kanban board, a hardware bill
of materials and a software/tools list. Progress percentage is calculated automatically; the
supervisor sets a status flag. Meetings, a timeline and in-app deadline reminders keep everyone
aligned.

**Why this priority**: Tracking is the daily value for students and supervisors and the data source
for completion reports and defense eligibility.

**Independent Test**: Apply a phase template to an approved project, submit a deliverable twice,
have the supervisor request changes then approve, and verify completion % updates, late flags,
versions, timeline events and reminders.

**Acceptance Scenarios**:

1. **Given** a college phase template with weights summing to 100%, **When** a project is
   approved, **Then** the project gets its own copy of the phases and the attached forms are
   downloadable from each phase.
2. **Given** a template whose weights do not sum to 100%, **When** the admin saves it, **Then**
   saving is rejected with an Arabic message.
3. **Given** a deliverable is submitted after its due date, **Then** it is marked "متأخر" (late)
   and still accepted.
4. **Given** a deliverable has version 1, **When** the team uploads a new file, **Then** version 2
   is created and version 1 remains downloadable.
5. **Given** a phase weighted 20% with 2 required deliverables, **When** 1 is approved, **Then**
   the project completion increases by 10 percentage points.
6. **Given** a file of a disallowed type or exceeding the size limit, **When** uploaded, **Then**
   it is rejected with an Arabic message suggesting a link for large videos.
7. **Given** a BOM with items, **When** quantities and prices are entered, **Then** the estimated
   total budget is shown and updated automatically.
8. **Given** a deliverable is due in 3 days, **Then** each team member receives an in-app reminder.

---

### User Story 4 - Communication, Chat & Media (Priority: P4)

Each project has a real-time group chat (team + supervisor), a private team-only channel, and
direct messages between a student and their supervisor, with attachments, mentions, replies, read
receipts and search. Deliverables and tasks have comment threads. Admins and supervisors post
announcements to their teams. Each project has a media gallery with albums. All notifications are
in-app only. Admins can remove inappropriate content.

**Why this priority**: Communication improves collaboration but the platform is usable without it
(teams may use external channels initially).

**Independent Test**: Exchange messages in each channel type, verify the supervisor cannot read the
team-only channel, mention a user and verify a notification, search messages, upload photos to an
album and mark them public/private, and have an admin remove a message.

**Acceptance Scenarios**:

1. **Given** a team member sends a message in the project group chat, **Then** the other online
   members and supervisor see it within 2 seconds without refreshing.
2. **Given** the team-only channel, **When** the supervisor attempts to open it, **Then** access is
   denied.
3. **Given** a message mentioning "@أحمد", **Then** أحمد receives an in-app notification linking to
   the message.
4. **Given** a supervisor posts an announcement, **Then** every member of every team they
   supervise receives it in the notification center.
5. **Given** an admin removes a message, **Then** it is replaced by "تم حذف هذه الرسالة من قبل
   الإدارة" and the action is audited.
6. **Given** a gallery photo marked private, **Then** it never appears on the public mini-site.

---

### User Story 5 - Defense & Evaluation (Priority: P5)

Colleges define grading rubrics with weighted criteria and a split between supervisor and committee
marks, yielding a team grade and an individual grade per student. A project becomes eligible for
defense after required phases are approved and the supervisor signs off. Admins form committees
(chair, members, external examiner) under conflict-of-interest rules and schedule defenses. Each
examiner grades independently; the system computes the final grade; the chair finalizes and the
grade is locked. Re-evaluation goes through an audited request flow. Minutes, recommendations and
required modifications are recorded, and a printable result letter/certificate is generated.

**Why this priority**: Evaluation is the culmination of the cycle but happens once per year and
depends on P1–P3.

**Independent Test**: Configure a rubric, sign off a project, form a valid committee, schedule a
defense, enter independent grades from each examiner, finalize, confirm lock, request and approve a
re-evaluation, and print the result letter.

**Acceptance Scenarios**:

1. **Given** a project with an unapproved required phase, **When** an admin tries to schedule its
   defense, **Then** scheduling is blocked and the missing phases are listed.
2. **Given** a committee whose only examiner is the project's supervisor, **When** saved, **Then**
   it is rejected for conflict of interest.
3. **Given** two examiners scheduled in the same room or overlapping time, **Then** the system
   warns about the conflict before saving.
4. **Given** examiner A has submitted grades, **When** examiner B grades, **Then** B cannot see
   A's grades until all examiners have submitted.
5. **Given** a rubric of supervisor 40% / committee 60%, supervisor mark 80 and committee
   examiners 70 and 90, **Then** the final team grade is 0.4×80 + 0.6×80 = 80.
6. **Given** the chair finalizes the grade, **When** anyone tries to edit it, **Then** editing is
   blocked; only an approved re-evaluation can change it and old/new values are audited.
7. **Given** post-defense modifications with a deadline, **When** the deadline passes without
   supervisor confirmation, **Then** the project is flagged and admins are notified.
8. **Given** a finalized grade, **When** the student requests the result letter, **Then** a
   printable Arabic PDF is produced with the university/college identity and grade details.

---

### User Story 6 - Public Showcase (Mini-site per Project), Voting & Investors (Priority: P6)

Every project can have a public mini-site at its own link (e.g., `/p/{project-slug}`) with cover,
slogan, problem/solution, features, technologies and components, gallery, demo video embed, team
(only what members allow), supervisor, college, achievements and an interest button. The team edits
sections, picks a template/color, shows/hides sections and publishes after first-time supervisor
approval. The public home page shows featured, trending and most-voted projects with search and
filters, plus a showcase page per college. Logged-in users vote once per project with anti-fraud
protection; optional competitions are time-limited. Approved investors follow, bookmark, request
contact, and publish challenges. Public comments are moderated.

**Why this priority**: High visibility value, but depends on projects existing and being tracked.

**Independent Test**: Build and publish a mini-site after supervisor approval, view it while
logged out, vote as a visitor with an account older than the minimum age, try a second vote, send an
investor contact request and accept it, and post/moderate a comment.

**Acceptance Scenarios**:

1. **Given** a team has never published, **When** they click publish, **Then** the page goes to the
   supervisor for approval and is not public until approved.
2. **Given** a published page with the "Team" section showing a member who hid their email,
   **Then** the email is not displayed publicly.
3. **Given** a logged-out visitor, **When** they click "صوّت", **Then** they are asked to log in or
   create a light account.
4. **Given** a user already voted for a project, **When** they vote again, **Then** the second vote
   is rejected and the count is unchanged.
5. **Given** an account younger than the minimum account age, **When** it votes, **Then** the vote
   is rejected with a message showing when voting becomes available.
6. **Given** an investor sends a contact request, **When** the team accepts, **Then** contact
   details the team chose to share are revealed to the investor; if declined, nothing is shared.
7. **Given** the team unpublishes the page, **Then** the public link shows "هذا المشروع غير متاح
   حالياً" and the page is removed from listings.
8. **Given** a competition has ended, **When** a user votes in it, **Then** the vote is rejected and
   final rankings are frozen.

---

### User Story 7 - Dashboards & Reports (Priority: P7)

University, College and Department Admins and Supervisors have dashboards with drill-down
University > College > Department > Project, always limited to their scope. Required reports:
project reports, completion rates (نسب الإنجاز), distribution of projects over supervisors (توزيع
المشاريع على المشرفين) and evaluation statistics (إحصائيات التقييم), plus insights on fields,
technologies, budgets, late submissions, votes and investor interest. Charts are interactive with
year filters and year-over-year comparison; any report exports to PDF and Excel.

**Why this priority**: Management value that aggregates data produced by all earlier stories.

**Independent Test**: With seeded data across two colleges, open each report as a College Admin,
verify only own-college data appears, drill down to a project, compare two years and export to PDF
and Excel with matching figures.

**Acceptance Scenarios**:

1. **Given** a College Admin, **When** they open the completion-rates report, **Then** they see
   average progress and counts of on track / at risk / delayed projects per phase for their college
   only.
2. **Given** the supervisor distribution report, **Then** it shows each supervisor's load vs.
   capacity and lists unassigned projects.
3. **Given** the evaluation statistics report filtered to two years, **Then** averages, grade
   distribution and pass/fail rates are shown side by side.
4. **Given** any report on screen, **When** exported to Excel or PDF, **Then** the exported figures
   match the on-screen figures and the export is in Arabic, right-to-left.
5. **Given** a Supervisor, **When** they open their dashboard, **Then** they see only projects they
   supervise or co-supervise.

---

### Edge Cases

- A student changes department after registering for a project: the project stays in its original
  department; admins of the new department do not gain access to it.
- A supervisor is deactivated mid-cycle: their projects appear as "بدون مشرف" in the distribution
  report and admins are notified to reassign.
- A team member is removed or moved by an admin after approval: the history keeps their past
  contributions; students cannot self-leave after approval; if team size drops below minimum, the
  supervisor and admin are notified (no automatic block).
- The team leader's account is deactivated: leadership must be transferred by an admin before
  further proposal changes.
- Cross-college team where one college disallows cross-college teams: the invitation is blocked.
  When allowed, only the leader's college/department manages the project; partner colleges/departments
  have read-only visibility into the project summary and their student's final grade (FR-034).
- Phase weights changed in the template after projects copied it: existing project copies are not
  changed automatically.
- Two examiners submit grades at the same moment as the chair finalizes: finalization requires all
  examiner grades submitted; it is blocked otherwise.
- An external examiner who is not a platform user: they are invited via link and receive a
  Committee Member role scoped only to that defense.
- A slug collision for two projects with the same title: the second slug gets a numeric suffix.
- A published project's supervisor approval is revoked or the project is rejected: the page
  is unpublished automatically (academic-year rollover archives remain visible read-only on the
  showcase).
- Many votes from the same IP within a short period: votes beyond the rate limit are rejected and
  flagged for admin review.
- Excel import file with wrong columns or empty: the import is rejected entirely with a clear
  message and a downloadable sample template.
- A genuine student finds their email or student ID already taken by an impostor: they contact
  their college admin, who deactivates the impostor account and releases the identifiers (FR-013a);
  the impostor's project memberships and votes are removed from counts.
- An invite link is opened after expiry or after already being used: an Arabic message asks the
  user to request a new invite.
- Academic year rollover: previous-year projects become read-only archives (except audited
  re-evaluation) and remain visible in reports and the showcase.

## Requirements *(mandatory)*

### Functional Requirements

#### General & Cross-cutting

- **FR-001**: The system MUST present the entire interface in Arabic only, right-to-left, with no
  language switcher; dates, numbers and validation messages MUST be shown in Arabic.
- **FR-002**: The system MUST authorize every non-public action by both the user's role and scope
  (University > College > Department > Project/Team) and MUST NOT reveal data outside the user's
  scope.
- **FR-003**: The system MUST send no emails; all notifications MUST be delivered in an in-app
  notification center.
- **FR-004**: The system MUST record an audit log entry (actor, action, target, time, before/after)
  for approvals, grading, re-evaluation, role/scope changes, deactivations, content removal and
  other admin actions; audit logs MUST be viewable by admins within their scope.
- **FR-005**: The system MUST keep versioned, timestamped history with actor identity for proposals,
  submissions, reviews and grades.
- **FR-006**: All lists MUST be paginated and support the filters described per story.

#### P1 — Accounts, Roles & Structure

- **FR-010**: University Admins MUST be able to create, edit and deactivate colleges; College Admins
  MUST be able to create, edit and deactivate departments in their college. Deactivation MUST NOT
  delete historical data.
- **FR-011**: Each college MUST be able to define academic years, semesters and project-cycle
  deadlines: registration window, proposal deadline and defense period.
- **FR-012**: The system MUST support the roles University Admin, College Admin, Department Admin,
  Supervisor, Committee Member/Examiner, Student (Team Leader / Team Member), Industry/Investor and
  Visitor; a user MAY hold multiple roles, each tied to a scope, and MUST be able to switch between
  role dashboards.
- **FR-013**: Students MUST be able to self-register with university email, student ID, password,
  college and department, with immediate activation (no email verification or approval). Email
  and student ID MUST be unique. Only emails on the university's configured domain(s) MUST be
  accepted for student sign-up; no roster matching or other identity check is performed.
- **FR-013a**: College Admins MUST be able to deactivate a fraudulent student account in their
  college and release its email and student ID so the genuine student can register; the action
  MUST be audited.
- **FR-014**: Users MUST log in with email and password and MUST be able to change their password
  from their profile.
- **FR-015**: College Admins MUST be able to reset the password of users in their college; the
  system MUST generate a temporary password shown once and force a change at next login.
- **FR-016**: Admins MUST be able to invite supervisors and lower-level admins via single-use invite
  links that expire after 7 days and pre-assign the role and scope.
- **FR-017**: Industry/Investor users MUST be able to self-register (name, organization, email,
  password, field of interest) and MUST remain in "pending" state with no investor features
  (public browsing only) until approved or rejected by the University Admin (with optional reason
  shown on rejection; approval and rejection MUST be audited).
- **FR-018**: Visitors MUST be able to create light accounts (name, email, password) used for voting
  and commenting.
- **FR-019**: College Admins MUST be able to bulk-import students and supervisors from an Excel file
  using a downloadable template; valid rows MUST be imported and invalid rows reported row-by-row
  with reasons. Imported users receive a temporary password shown to the admin and must change it at
  first login.
- **FR-020**: Users MUST be able to edit a profile with photo, bio and skills, and set privacy for
  each contact field (email, phone, social links); contact fields MUST be private by default.
- **FR-021**: Admins MUST be able to search and filter users within their scope, deactivate and
  reactivate them, and assign or revoke roles at or below their own scope.
- **FR-022**: Each role MUST have a home dashboard showing information relevant to that role.

#### P2 — Projects, Teams & Supervisors

- **FR-030**: A student MUST be able to create a proposal with title, idea, problem statement,
  objectives, scope, field/domain, project type (software, hardware, hybrid, research, design),
  beneficiaries, keywords, expected outcomes and cover image; the creator becomes Team Leader. A
  student MAY belong to only one active project per academic year: they become eligible to create or
  join another project in the same year only if their proposal is Rejected or withdrawn, or if they
  leave or are removed before Approval; after Approval, they are locked to that project for the year
  unless an admin moves or removes them (audited).
- **FR-031**: Proposal creation and submission MUST be allowed only within the college's
  registration window / before the proposal deadline.
- **FR-032**: The system MUST warn (not block) when a proposal title is similar to existing project
  titles in the university, listing the similar titles.
- **FR-033**: Team leaders MUST be able to invite members by search or invite link; invitees MUST be
  able to accept or decline; min and max team size MUST be configurable per college and enforced at
  invitation (max) and submission (min).
- **FR-034**: Cross-college teams MUST be allowed only when the colleges of all members allow it;
  the project belongs to the leader's college and department, whose rules (team size limits,
  deadlines, phase templates, grading rubric, and approvals) apply. College and Department Admins of
  non-leader members MUST receive read-only access to the project summary, status, and their
  student's final grade, with no edit or approval permissions.
- **FR-035**: Team leaders MUST be able to transfer leadership to another member, who must accept.
- **FR-036**: Supervisors and approved industry partners MUST be able to publish ideas in an ideas
  bank; teams MUST be able to request adoption, and the idea owner MUST accept or decline.
- **FR-037**: Proposals MUST follow a two-step review workflow: Draft → Submitted → Under Review →
  Needs Changes → (resubmitted) → Supervisor Recommended → Approved / Rejected, with comments at
  each step and full history. In Step 1, the reviewing supervisor (assigned or preferred supervisor,
  or a department supervisor assigned to review by the Department Admin) reviews the proposal and
  either requests changes or submits a recommendation with comments. In Step 2, the Department
  Admin (or College Admin within scope) issues the final Approved or Rejected decision (or returns
  the proposal to Needs Changes); the final decision MUST be audited.
- **FR-038**: Students MUST be able to request a preferred supervisor; admins MUST assign a
  supervisor and optionally a co-supervisor and/or industry mentor.
- **FR-039**: Each college MUST configure a maximum number of active primary-supervised projects
  per supervisor per academic year (co-supervision and industry mentoring MUST NOT count toward this
  cap). Assignments exceeding the cap MUST be blocked by default; only a College Admin (or
  University Admin) MAY override the cap by providing a mandatory reason, which MUST be logged in
  the audit log. A supervisor load view MUST show primary load vs. capacity (and co-supervision
  count separately).
- **FR-040**: Each role MUST have a project list filterable by year, college, department, status,
  supervisor and field, and a project overview page summarizing team, supervisor, status, progress
  and recent activity.

#### P3 — Phases, Deliverables & Tracking

- **FR-050**: Colleges MUST define phase templates with name, order, weight (summing to 100%), due
  date and required deliverables, and MUST be able to attach downloadable official forms (نماذج).
- **FR-051**: On approval, each project MUST receive its own copy of the phase template; the
  supervisor MUST be able to adjust project dates and add milestones without affecting the template.
- **FR-052**: Teams MUST be able to submit deliverables with attachments (PDF, Word, PowerPoint,
  images, ZIP) within size limits and with links (GitHub, YouTube, Google Drive); every submission
  MUST create a new version and all versions MUST be retained.
- **FR-053**: Supervisors MUST be able to Approve, Request Changes (with comments) or Reject each
  submission; submissions after the due date MUST be flagged late.
- **FR-054**: Each team MUST have a Kanban board (columns: to do, in progress, review, done) with
  tasks assignable to members, due dates and comments.
  *(Amendment 2026-11-24, product-owner decision: task management — create, move, edit, delete —
  is restricted to the team leader; other members have read-only access to the board. Task
  comments remain open to all team members.)*
- **FR-055**: Teams MUST maintain a hardware bill of materials (item, quantity, specs, unit price,
  supplier, status: needed/ordered/received) and a software/tools list (languages, frameworks,
  libraries, services); the system MUST compute an estimated total budget.
- **FR-056**: The system MUST compute completion % as the sum over all project phases of
  `(phase weight × approved required deliverables ÷ total required deliverables of that phase)`. A
  phase with zero required deliverables MUST earn its full phase weight once the supervisor marks
  that phase complete. Late-approved deliverables MUST count toward completion %. Supervisor-added
  milestones and Kanban tasks MUST NOT affect completion %. If an approval is revoked or changed,
  completion % MUST recalculate immediately.
- **FR-057**: Supervisors MUST be able to set a project status of on track / at risk / delayed.
- **FR-058**: Teams and supervisors MUST be able to log meetings (date, attendees, notes, action
  items); action items MAY be converted into Kanban tasks.
- **FR-059**: Each project MUST have a timeline showing all events (status changes, submissions,
  reviews, meetings, assignments) in chronological order.
- **FR-060**: The system MUST send in-app reminders to team members 3 days and 1 day before each
  deliverable due date and on the due date.

#### P4 — Communication & Media

- **FR-070**: Each project MUST have a real-time group chat (team + supervisor/co-supervisor/
  mentor), a private team-only channel inaccessible to supervisors, and direct messages between a
  student and their supervisor.
- **FR-071**: Chat MUST support attachments, mentions, replies, read receipts and message search
  within channels the user can access.
- **FR-072**: Deliverables and tasks MUST have comment threads.
- **FR-073**: Admins and supervisors MUST be able to post announcements to all teams within their
  scope / supervision.
- **FR-074**: Each project MUST have a media gallery with albums: photos uploaded to the platform,
  videos added as YouTube/Google Drive links; each item MUST be marked public or private (default
  private).
- **FR-075**: Users MUST have an in-app notification center with unread counts and mark-as-read.
- **FR-076**: Admins MUST be able to remove inappropriate chat messages, comments and media within
  their scope; removals MUST be audited.

#### P5 — Defense & Evaluation

- **FR-080**: Colleges MUST define grading rubrics with weighted criteria (e.g., innovation,
  technical work, documentation, presentation, teamwork), each tagged as either **Team** (one score
  shared by all team members) or **Individual** (scored separately per student), plus the split
  between supervisor and committee components; criteria weights MUST sum to 100% and supervisor +
  committee percentages MUST sum to 100%.
- **FR-081**: The system MUST produce both a shared team-criteria score and a final individual
  grade (0–100) per student. For each evaluator (supervisor and each committee examiner), a
  student's total is the weighted sum of the team-criteria scores plus that student's
  individual-criteria scores. If a college defines no individual criteria, all members receive the
  same final grade.
- **FR-082**: A project MUST be eligible for defense only after all required phases are approved and
  the supervisor signs off.
- **FR-083**: Admins MUST be able to form defense committees with a chair, members and an optional
  external examiner; the project's primary supervisor and co-supervisors MUST NOT serve as committee
  chair or scoring committee examiners (they grade strictly through the supervisor rubric
  component), and every committee MUST have at least one independent examiner besides the
  supervisor.
- **FR-084**: Admins MUST schedule defenses with date, time, and room or online meeting link; the
  system MUST provide a calendar view, warn on room/examiner time conflicts, and notify team,
  supervisor and committee in-app.
- **FR-085**: Each examiner MUST grade independently online and MUST NOT see other examiners'
  grades until all have submitted.
- **FR-086**: The system MUST calculate each student's final grade automatically as
  `(Supervisor % × student's supervisor total) + (Committee % × average of committee examiners'
  totals for that student)`. The project's shared team grade is computed with the same supervisor/
  committee split over the Team-tagged criteria (normalized or shown alongside each student's final
  grade).
- **FR-086a**: After all examiners submit, if the spread between the highest and lowest committee
  examiner totals for any student exceeds a college-configured threshold (default 15 points out of
  100), the system MUST warn the committee chair. Before finalizing, the chair MAY unlock examiner
  scores for deliberation revision (all prior and revised scores MUST be preserved as versioned
  records), OR finalize as-is by recording a mandatory justification note (audited).
- **FR-087**: The chair MUST finalize the grade once all grades are submitted; finalized grades MUST
  be locked and immutable. A student (for their grade/project) or the supervisor MAY submit at most
  one re-evaluation request within a college-configured window after finalization (default 7 days)
  with a mandatory written reason. Only the College Admin MAY approve or reject the request; upon
  approval, grading reopens for the original committee or a replacement committee assigned by the
  College Admin to submit revised versioned scores and re-finalize. Requester, approver, reason,
  old values and new values MUST be preserved in version history and the audit log.
- **FR-088**: The committee MUST be able to record defense minutes, recommendations and required
  post-defense modifications with a deadline; the supervisor confirms completion.
- **FR-089**: The system MUST generate a printable Arabic PDF result letter / certificate for
  finalized grades containing the university/college identity, project title, the student's own
  final grade, pass/fail status, and aggregated criterion breakdown.
- **FR-089a**: Before finalization, students MUST NOT see any supervisor or examiner scores. After
  finalization, each student MUST see only their own final grade, pass/fail status, aggregated
  rubric breakdown (supervisor score and averaged committee score per criterion), and defense
  recommendations/required modifications; individual examiners' separate scores and teammates'
  individual grades MUST be hidden from students.
- **FR-090**: Each college MUST configure a pass mark (default 60%).

#### P6 — Showcase, Voting & Investors

- **FR-100**: Each project MUST be able to have a public mini-site at a unique, human-readable link
  (`/p/{project-slug}`) with sections: cover and slogan, problem and solution, features,
  technologies and hardware component names (without prices or suppliers), photo gallery (public
  items only), demo video embed, team (member names/avatars plus only contact fields each member
  explicitly opts in to share), supervisor name, college, achievements, and contact/interest button.
- **FR-100a**: Nothing of a project MUST be public until its mini-site is published. Once
  published, the core showcase sections listed in FR-100 are visible by default (unless hidden by
  the team). Grades, internal deliverables, BOM unit prices/suppliers/total budget, tasks, meetings
  and chat MUST NEVER be exposed on public endpoints. Student contact details MUST stay private by
  default and appear only per individual student opt-in (FR-020).
- **FR-101**: The team MUST be able to edit each section, choose from at least 3 templates and a set
  of color themes, show/hide sections, preview, and publish/unpublish.
- **FR-102**: Only Approved projects MUST be eligible to request mini-site publication. First
  publication MUST require supervisor approval (audited). Once approved, subsequent routine edits
  by the team are published directly; a supervisor or in-scope admin MAY unpublish the page at any
  time (with a reason recorded in the audit log), after which re-publishing MUST require fresh
  approval before going live again.
- **FR-103**: The public home page MUST show featured (chosen by admins), trending (ranked by
  `valid votes in last 7 days × 3 + unique page views in last 7 days`, tie-broken by total valid
  votes) and most-voted projects, with search and filters by college, department, field, year and
  type; each college MUST have a showcase page.
- **FR-104**: Only active logged-in users (all roles, excluding pending or deactivated accounts)
  MUST be able to vote, EXCEPT a project's own team members and assigned supervisor/co-supervisor/
  mentor (self-voting MUST be blocked). Each user MUST have at most one vote per project (per
  competition when within a competition) and MAY withdraw it while voting is open.
- **FR-105**: Voting MUST be protected by rate limits per account and per IP and by a minimum
  account age before voting (default 24 hours, configurable by the University Admin). Votes
  triggering suspicious burst rules (e.g., excessive votes from the same IP within a short window)
  MUST be flagged for admin review and MUST be excluded from live counts unless explicitly cleared
  by an admin (audited).
- **FR-106**: The system MUST show rankings and support optional time-limited competitions created
  by the University or a college, with eligibility (which projects), optional voter restriction
  (all logged-in accounts vs. university accounts only), start and end; rankings freeze at the end.
- **FR-107**: Approved investors/industry MUST be able to follow and bookmark projects, send
  contact requests to published projects, and publish challenges/ideas directly to the ideas bank
  (removable by in-scope admins with audit log). Only the project's Team Leader MAY accept or
  decline a contact request; upon acceptance, ONLY the contact details explicitly entered or
  selected by the leader in the reply MUST be shared with the investor (other team members' private
  contact info MUST NOT be auto-exposed).
- **FR-108**: Logged-in users MUST be able to post public comments/questions on project pages; team
  members MAY reply; teams and admins MUST be able to hide/remove comments, and users MUST be able
  to report comments.

#### P7 — Dashboards & Reports

- **FR-120**: University, College and Department Admins and Supervisors MUST have dashboards with
  drill-down University > College > Department > Project, limited to their scope.
- **FR-121**: The system MUST provide project reports (lists and details across all proposal and
  project statuses in scope, filterable by status, year, college, department, supervisor and
  field).
- **FR-122**: The system MUST provide completion-rate reports over **Approved** (active/archived)
  projects in the selected academic year: mean completion %, counts and shares of `on track` /
  `at risk` / `delayed` projects, and per-phase average completion %.
- **FR-123**: The system MUST provide supervisor-distribution reports over **Approved** projects in
  the selected academic year: primary supervision load vs. college capacity per supervisor
  (FR-039), co-supervision count shown separately, remaining capacity, and list/count of Approved
  projects with no active primary supervisor (unassigned projects).
- **FR-124**: The system MUST provide evaluation statistics aggregated **per student** over
  **finalized** individual grades in the selected scope and year: mean/min/max grade, pass/fail
  counts and rates (using each project's college pass mark, FR-090), grade distribution in standard
  Arabic bands (`امتياز ≥85%`, `جيد جداً 75–<85%`, `جيد 65–<75%`, `مقبول passMark–<65%`, `راسب
  <passMark`), and comparisons across colleges, departments and years.
- **FR-125**: The system MUST provide insights on: Approved project counts by field and
  technology/tool; total and mean estimated BOM budgets across Approved projects with BOM entries;
  count and percentage of deliverable submissions flagged late across Approved projects; and
  showcase engagement (valid votes, unique views, investor follows, bookmarks, and contact requests
  by status across published projects).
- **FR-126**: Reports MUST have interactive charts, year filters, year-over-year comparison, and
  export to PDF and Excel in Arabic.

### Key Entities *(include if feature involves data)*

- **University**: The single institution; holds global settings (allowed email domains, voting
  rules).
- **College**: Belongs to University; holds cycle settings (team size, cross-college policy,
  supervisor capacity, pass mark).
- **Department**: Belongs to a College.
- **AcademicYear / Semester / ProjectCycle**: Per college; holds registration window, proposal
  deadline and defense period.
- **User**: A person with credentials, profile, privacy settings and status (active, pending,
  deactivated).
- **RoleAssignment**: Links a User to a Role and a scope node (university, college, department,
  project, or defense).
- **Invitation**: Single-use, expiring link that grants a role and scope (or team membership).
- **Project**: Proposal fields, status, college/department, cycle, slug, completion %, supervisor
  status flag.
- **ProposalVersion / StatusChange**: Historical versions and workflow transitions with comments.
- **Team / TeamMembership**: Members, leader, join/leave history.
- **SupervisorAssignment**: Supervisor, co-supervisor, industry mentor per project.
- **Idea**: Ideas-bank entry by supervisor or industry partner, with adoption requests.
- **PhaseTemplate / ProjectPhase / Milestone**: Template phases with weights, due dates, forms;
  per-project copies.
- **Deliverable / Submission (versioned) / Review**: Required deliverables, submitted versions with
  attachments/links, and review decisions.
- **Task**: Kanban task with assignee, status, due date.
- **BOMItem / ToolItem**: Hardware components and software tools with cost data.
- **Meeting**: Date, attendees, notes, action items.
- **TimelineEvent**: Chronological project events.
- **Channel / Message**: Group, team-only and direct channels; messages with attachments, mentions,
  replies, read receipts.
- **Comment**: Threads on deliverables, tasks and public pages.
- **Announcement / Notification**: Broadcasts and per-user in-app notifications.
- **MediaAlbum / MediaItem**: Photos or video links with public/private flag.
- **Rubric / Criterion**: Weighted grading criteria and supervisor/committee split.
- **DefenseCommittee / Defense**: Committee members and roles; schedule, room/link, minutes,
  recommendations, modifications.
- **Grade / ExaminerScore / ReEvaluationRequest**: Per-examiner scores, computed team/individual
  grades, lock status, re-evaluation history.
- **ShowcasePage**: Mini-site sections, template, theme, visibility, publish state, approval.
- **Vote / Competition**: One vote per user per project (per competition), competition windows and
  rankings.
- **Follow / Bookmark / ContactRequest / Challenge**: Investor interactions.
- **AuditLog**: Immutable records of sensitive actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new student can sign up and reach their dashboard in under 2 minutes.
- **SC-002**: A team leader can create and submit a complete proposal in under 15 minutes.
- **SC-003**: A College Admin can import 500 students from an Excel file in under 5 minutes,
  including reviewing the error report.
- **SC-004**: 100% of attempts to access data outside a user's scope are denied in automated
  authorization tests.
- **SC-005**: 95% of pages load in under 2 seconds for users on a typical mobile connection.
- **SC-006**: Chat messages appear for other online participants within 2 seconds in 95% of cases.
- **SC-007**: Completion % and final grades computed by the system match manual calculations in
  100% of test cases.
- **SC-008**: Zero duplicate votes counted per user per project (per competition).
- **SC-009**: Every finalized-grade change is traceable to an approved re-evaluation with actor,
  reason and old/new values (100% audit coverage).
- **SC-010**: Report exports match on-screen figures in 100% of sampled reports, and any report can
  be generated in under 10 seconds for a full academic year.
- **SC-011**: No English UI text appears on any screen (verified by UI review of all screens).
- **SC-012**: The platform supports at least 5,000 registered users and 500 concurrent users during
  peak periods (registration week, defense season, voting) without degradation.
- **SC-013**: All primary journeys are usable on a 360px-wide mobile screen and meet WCAG 2.1 AA in
  accessibility audits.
- **SC-014**: At least 80% of supervisors report in a post-cycle survey that tracking progress is
  easier than the previous process.

## Assumptions

- The platform serves exactly one university; multi-university tenancy is out of scope.
- The university has one or more known email domains used to validate student sign-ups.
- Student identity is checked only against configured university email domain(s) on sign-up (no
  email verification or roster matching); misuse is handled reactively by College Admins
  deactivating the account and releasing its email/student ID (FR-013a).
- Password reset is admin-driven only (no self-service reset), consistent with the no-email rule.
- A student may participate in only one active graduation project per academic year, with re-entry
  allowed before Approval or after Rejection/withdrawal (FR-030).
- Proposals follow two-step approval: supervisor review/recommendation first, followed by final
  approval or rejection by the Department Admin (or College Admin within scope) (FR-037).
- Title similarity is a warning based on text similarity with existing titles; it never blocks.
- Individual grades follow the additive Team + Individual rubric criteria model (FR-080, FR-081,
  FR-086); colleges without individual criteria give every member the same final grade.
- Re-evaluation follows the bounded committee re-grading flow (FR-087): at most 1 request per
  student/project within a college-configured window (default 7 days), approved by the College
  Admin.
- Upload limits follow Cloudinary free-tier constraints: images, documents, and ZIP files up to
  10 MB each; larger archives and long videos are provided as GitHub, YouTube, or Google Drive
  links.
- Previous academic years become read-only archives but remain in reports and the showcase.
- Visitors and investors cannot see any non-published project data.
- Data is retained indefinitely for academic records; deactivated accounts are kept, not deleted.
- Real-time chat requires an active internet connection; offline messaging is out of scope.
- Native mobile apps are out of scope; the web app is mobile-first responsive.
- Integrations with external university systems (SIS/LMS) and plagiarism checking are out of scope
  for this version.
