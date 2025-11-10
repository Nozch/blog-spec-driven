---
description: "Task list for Personal Blog Publishing Flow"
---

# Tasks: Personal Blog Publishing Flow

**Input**: Design documents from `/specs/001-sample/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests MUST be written whenever the constitution or spec demands coverage. For every story below, write the listed tests before implementing code so they fail first.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions
- Link every task to the spec requirement or success criterion it satisfies so reviewers can trace spec -> plan -> task.

## Path Conventions

- **Single project**: `apps/web` (Next.js), `packages/*` for shared libs, `services/publisher` for BullMQ worker, `infra/terraform` for cloud resources, `supabase` for schema
- Paths shown below align with `pnpm` workspaces defined in plan.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish workspace layout, environment scaffolding, and shared tooling.

- [x] T001 Create workspace directories (`apps/web`, `packages/editor`, `packages/importer`, `packages/scheduler-sdk`, `services/publisher`, `infra/terraform`) and register them in `pnpm-workspace.yaml`.
- [x] T002 Define `.env.example` with all config keys from quickstart (`SUPABASE_URL`, `S3_DRAFT_BUCKET`, `UPSTASH_REDIS_REST_URL`, etc.) in repo root.
- [x] T003 Configure base lint/test scripts in `package.json` and ensure `pnpm test`, `pnpm playwright test`, and `pnpm k6` commands exist.
- [x] T004 Add feature flag toggle `personal-blog-publishing` to `infra/terraform/feature-flags.tf` with default `off`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that all stories depend on.

- [x] T005 Create Supabase migration defining Article, DraftStorage, PublishJob, Notifications tables plus indexes in `supabase/migrations/<ts>_blog_core.sql`.
- [x] T006 Add Supabase row-level security policies & RPC helpers for author-only drafts in `supabase/policies/blog_rp.sql`.
- [x] T007 Provision encrypted S3 bucket + IAM policy for draft blobs in `infra/terraform/s3-drafts.tf` with SSE-S3 enforced.
- [x] T008 Provision Upstash Redis + BullMQ queue config and outputs in `infra/terraform/redis-publisher.tf`.
- [x] T009 [P] Build shared TypeScript types + API client utilities for articles/jobs in `packages/scheduler-sdk/src/index.ts`.
- [x] T010 [P] Implement shared telemetry/logger wrapper emitting metrics defined in OR-002 at `packages/scheduler-sdk/src/telemetry.ts`.

**Checkpoint**: Database, storage, queue, and shared SDK ready—user stories can proceed independently.

---

## Phase 3: User Story 1 - Compose & Edit In-Browser (Priority: P1) 🎯 MVP

**Goal**: Browser editor with formatting, appearance controls, tag suggestions, and draft persistence.

**Independent Test**: Using only the browser UI, create a post, adjust font size/left padding, edit suggested tags, and publish without file import.

### Tests for User Story 1 (OPTIONAL - only if tests requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (Constitution P3).**

- [ ] T011 [P] [US1] Write contract tests for `POST /api/articles` in `apps/web/tests/contract/articles.post.test.ts` covering validation + persistence.
- [ ] T012 [P] [US1] Create Playwright scenario `apps/web/tests/e2e/editor-compose.spec.ts` for compose/edit/publish happy path.
- [ ] T013 [P] [US1] Add unit tests for TipTap extensions (headings, embeds, appearance controls) in `packages/editor/src/__tests__/extensions.spec.ts`.

### Implementation for User Story 1

- [ ] T014 [US1] Scaffold TipTap editor module with required extensions + MDX serialization in `packages/editor/src/editor.ts`.
- [ ] T015 [US1] Build compose page UI (toolbar, appearance controls, autosave) in `apps/web/app/(editor)/compose/page.tsx`.
- [ ] T016 [US1] Persist draft content + appearance settings via `POST /api/articles` route handler at `apps/web/app/api/articles/route.ts` integrating Supabase + S3 writes.
- [ ] T017 [US1] Implement auto-tag suggestion client hook calling Lambda endpoint in `apps/web/lib/tags/useTagSuggestions.ts` with editable chips UI.
- [ ] T018 [US1] Wire structured logging + analytics for editor events at `apps/web/lib/telemetry/editorLogger.ts`.
- [ ] T019 [US1] Ensure drafts render with chosen font size/padding in preview + published views (`apps/web/app/(home)/components/article-card.tsx`).
- [ ] T020 [US1] Add in-app warning UX for 8 MB limit + doc link during compose/import overlay in `apps/web/components/import-warning.tsx`.

**Checkpoint**: User can compose, style, tag, and publish directly in browser.

---

## Phase 4: User Story 2 - Import Markdown/MDX (Priority: P1)

**Goal**: Upload .md/.mdx manuscripts (≤8 MB) with embedded asset validation and warnings.

**Independent Test**: Import a compliant MDX file, get warnings for oversized assets, and publish successfully.

### Tests for User Story 2 (OPTIONAL - only if tests requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (Constitution P3).**

- [ ] T021 [P] [US2] Write contract tests for `POST /api/articles/import` (success + 8 MB rejection) in `apps/web/tests/contract/articles.import.test.ts`.
- [ ] T022 [P] [US2] Add Playwright flow `apps/web/tests/e2e/import-mdx.spec.ts` covering upload, warning banner, and publish.

### Implementation for User Story 2

- [ ] T023 [US2] Implement MD/MDX parsing + asset scanner in `packages/importer/src/parser.ts` (validates file + referenced media sizes).
- [ ] T024 [US2] Build import modal + drag/drop component in `apps/web/app/(editor)/components/import-dialog.tsx` that surfaces inline toast + file callouts.
- [ ] T025 [US2] Implement `POST /api/articles/import` Next.js route at `apps/web/app/api/articles/import/route.ts` to stream upload, run importer, and persist Article records.
- [ ] T026 [US2] Store uploaded files temporarily in S3 `drafts/imports/` and clean up after persistence via job in `packages/importer/src/storage.ts`.
- [ ] T027 [US2] Update editor state hydrator `apps/web/lib/editor/hydrateFromImport.ts` to map imported MDX into TipTap document.
- [ ] T028 [US2] Emit telemetry + alerts when validation fails due to oversize assets in `apps/web/lib/telemetry/importLogger.ts`.

**Checkpoint**: Users can import manuscripts with clear validation + warnings.

---

## Phase 5: User Story 3 - Draft, Schedule, and Publish Control (Priority: P2)

**Goal**: Secure draft privacy, JST scheduling with prompts, failure notifications, top-page pagination with 12 posts/page, and publish toggle controls.

**Independent Test**: Save a private draft, schedule future JST publish, edit content (prompted to reschedule), receive email on failure, and toggle published article back to private with header update.

### Tests for User Story 3 (OPTIONAL - only if tests requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (Constitution P3).**

- [ ] T029 [P] [US3] Write contract tests for `POST /api/articles/{id}/schedule` + `/toggle` in `apps/web/tests/contract/articles.schedule.test.ts`.
- [ ] T030 [P] [US3] Build Playwright flow `apps/web/tests/e2e/schedule-toggle.spec.ts` covering draft -> schedule -> edit prompt -> failure notification.
- [ ] T031 [P] [US3] Add Jest tests for BullMQ worker job handling + retry logic in `services/publisher/tests/publish.worker.spec.ts`.

### Implementation for User Story 3

- [ ] T032 [US3] Enforce draft privacy by adding Supabase RLS + signed URL generation helper in `apps/web/lib/drafts/getDraftUrl.ts`.
- [ ] T033 [US3] Implement scheduling modal (JST picker, validation, prompt) in `apps/web/app/(editor)/components/schedule-dialog.tsx`.
- [ ] T034 [US3] Build `POST /api/articles/[id]/schedule/route.ts` to queue BullMQ jobs with UTC conversion and conflict detection.
- [ ] T035 [US3] Add edit interception logic prompting reschedule when modifying scheduled posts in `apps/web/app/(editor)/compose/page.tsx`.
- [ ] T036 [US3] Implement BullMQ worker `services/publisher/src/jobs/publish.ts` to publish, purge caches, and log metrics.
- [ ] T037 [US3] Create failure email notification sender via AWS SES in `services/publisher/src/notifications/email.ts` using template from research.
- [ ] T038 [US3] Implement `POST /api/articles/[id]/toggle/route.ts` that flips published/private, triggers cache purge, and logs audit events.
- [ ] T039 [US3] Build category pagination API + ISR cache invalidation with 12 posts/page in `apps/web/app/api/articles/route.ts` (GET branch) and `apps/web/app/(home)/page.tsx`.
- [ ] T040 [US3] Add monitoring dashboards/alerts for `publish.success_rate` and cache purge latency in `infra/terraform/observability.tf`.

**Checkpoint**: Scheduling, privacy, toggles, and category navigation behave per spec with observability + notifications.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story improvements and release readiness.

- [ ] T041 Update public docs + runbook in `docs/blog/publishing.md` (compose/import/schedule flow + failure recovery).
- [ ] T042 Harden accessibility (keyboard support for editor/import/schedule dialogs) with audit in `apps/web/tests/a11y/editor-axe.spec.ts`.
- [ ] T043 [P] Add caching/perf tests using k6 script `perf/first-paint.js` to confirm SC-001.
- [ ] T044 Implement feature flag rollout + kill switch wiring in `apps/web/lib/flags/useFeatureFlag.ts` and `services/publisher/src/config/flags.ts`.
- [ ] T045 Conduct security review & threat model documenting draft privacy + queue abuse mitigations in `docs/security/blog-publishing.md`.
- [ ] T046 Final QA checklist + sign-off recorded in `specs/001-sample/checklists/release.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) → prerequisite for Foundational.
- Foundational (Phase 2) → prerequisite for all user stories.
- US1 is MVP and must complete before deployment; US2 can run parallel after Foundational; US3 begins once Supabase + queue infra ready but can overlap with US2 except where sharing UI components.
- Polish phase runs after desired user stories complete.

### User Story Dependencies

- US1: no dependencies once Phase 2 done.
- US2: depends on importer package + storage from Phase 2 but not on US1 completion.
- US3: depends on Phase 2 plus basic Article persistence (US1) so scheduling edits operate on same Article model.

### Parallel Opportunities

- Tasks tagged [P] can run concurrently (e.g., shared SDK + telemetry, contract tests across stories, worker test harness).
- Different user stories (US2 vs US3) may proceed in parallel after Foundational completion provided they avoid shared files.

## Parallel Example: User Story 2

```
pnpm concurrently "pnpm --filter apps/web test -- import" "pnpm --filter packages/importer build"
# Parallel tasks:
# - T021 contract tests (apps/web/tests/contract/articles.import.test.ts)
# - T023 importer parser implementation (packages/importer/src/parser.ts)
# - T024 import dialog UI (apps/web/app/(editor)/components/import-dialog.tsx)
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational.
2. Deliver US1 compose flow with editor, persistence, tagging, and publish.
3. Validate via Jest + Playwright tests; release to pilot behind feature flag.

### Incremental Delivery

1. Add US2 import pipeline once MVP is stable; ship after import-specific tests pass.
2. Layer in US3 scheduling + category pagination; monitor publish success metrics and failure emails.

### Parallel Team Strategy

- Developer A owns US1 editor experience.
- Developer B builds importer + validations (US2).
- Developer C implements scheduler worker + pagination (US3).
- DevOps partner handles infra tasks (Phase 2 + observability) and supports feature flag rollout.
