# Tasks: Personal Blog Publishing Flow

**Input**: Design documents from `/specs/001-sample/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in the feature specification, so test tasks are omitted per guidelines.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md, this is a web monorepo with:
- `apps/web/` - Next.js 14 front-end + API routes
- `packages/` - Shared packages (editor, importer, scheduler-sdk)
- `services/publisher/` - Background worker
- `infra/terraform/` - Infrastructure as code

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure per plan.md

- [x] T001 Create monorepo structure with apps/, packages/, services/, infra/ directories
- [x] T002 Initialize package.json at root with pnpm workspace configuration
- [x] T003 [P] Setup TypeScript 5.6 configuration in tsconfig.json at root
- [x] T004 [P] Configure ESLint and Prettier in .eslintrc.js and .prettierrc
- [x] T005 [P] Create apps/web directory and initialize Next.js 14 App Router project
- [x] T006 [P] Initialize packages/editor with TipTap 2 dependencies in packages/editor/package.json
- [x] T007 [P] Initialize packages/importer with Contentlayer dependencies in packages/importer/package.json
- [x] T008 [P] Initialize packages/scheduler-sdk with BullMQ types in packages/scheduler-sdk/package.json
- [x] T009 [P] Initialize services/publisher with Node 18 + BullMQ worker in services/publisher/package.json
- [x] T010 [P] Setup environment configuration schema in apps/web/lib/env.ts
- [x] T011 [P] Create .env.example with all config keys from quickstart.md in repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T012 Create Supabase migration for Article table in supabase/migrations/001_create_articles.sql
- [x] T013 [P] Create Supabase migration for DraftStorage table in supabase/migrations/002_create_draft_storage.sql
- [x] T014 [P] Create Supabase migration for PublishJob table in supabase/migrations/003_create_publish_jobs.sql
- [x] T015 [P] Create Supabase migration for Notifications table in supabase/migrations/004_create_notifications.sql
- [x] T016 [P] Create Supabase migration for CategoryPageCache table in supabase/migrations/005_create_category_cache.sql
- [x] T017 Setup Supabase RLS policies for author-only draft access in supabase/migrations/006_rls_policies.sql
- [x] T018 [P] Create Terraform configuration for S3 draft bucket with SSE-S3 encryption in infra/terraform/s3-drafts.tf
- [x] T019 [P] Create Terraform configuration for Upstash Redis in infra/terraform/redis-publisher.tf
- [x] T020 [P] Setup AWS SES sender identity configuration in infra/terraform/ses.tf
- [x] T021 [P] Create Supabase client factory with auth in apps/web/lib/supabase.ts
- [x] T022 [P] Implement S3 client with signed URL generation in apps/web/lib/s3.ts
- [x] T023 [P] Create base error handling middleware in apps/web/lib/middleware/error-handler.ts
- [x] T024 [P] Implement logging infrastructure with author_id/article_id context in apps/web/lib/logger.ts
- [x] T025 [P] Setup Web Vitals instrumentation for frontend.first_paint_ms in apps/web/lib/web-vitals.ts
- [x] T026 Create shared Article TypeScript types in packages/scheduler-sdk/src/types/article.ts
- [x] T027 [P] Create shared PublishJob TypeScript types in packages/scheduler-sdk/src/types/publish-job.ts
- [x] T028 [P] Create shared telemetry utilities emitting metrics from OR-002 in packages/scheduler-sdk/src/telemetry.ts
- [x] T029 [P] Setup feature flag for personal-blog-publishing rollout in infra/terraform/feature-flags.tf

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Compose & Edit In-Browser (Priority: P1) 🎯 MVP

**Goal**: Enable individual bloggers to write and edit articles directly in the browser with formatting controls, appearance adjustments, and auto-suggested tags

**Independent Test**: Create a full article using only the browser UI, adjust font size/padding, edit suggested tags, and publish without importing files

### Implementation for User Story 1

- [X] T030 [P] [US1] Create TipTap extension for headings in packages/editor/src/extensions/heading.ts
- [X] T031 [P] [US1] Create TipTap extension for bold/italic in packages/editor/src/extensions/text-styles.ts
- [ ] T032 [P] [US1] Create TipTap extension for code blocks in packages/editor/src/extensions/code-block.ts
- [ ] T033 [P] [US1] Create TipTap extension for image embeds with size validation in packages/editor/src/extensions/image-figure.ts
- [ ] T034 [P] [US1] Create TipTap extension for video embeds with provider allowlist in packages/editor/src/extensions/video-embed.ts
- [ ] T035 [US1] Create TipTap extension for appearance controls (font-size, left-padding) in packages/editor/src/extensions/appearance.ts
- [ ] T036 [US1] Implement TipTap editor factory with all extensions in packages/editor/src/editor-factory.ts
- [ ] T037 [US1] Implement TipTap to MDX serializer in packages/editor/src/serializers/mdx-serializer.ts
- [ ] T038 [US1] Implement MDX to TipTap JSON parser in packages/editor/src/parsers/mdx-parser.ts
- [ ] T039 [P] [US1] Create editor React component in apps/web/components/editor/editor.tsx
- [ ] T040 [P] [US1] Create appearance controls UI component in apps/web/components/editor/appearance-controls.tsx
- [ ] T041 [P] [US1] Create tag editor UI component with editable suggestions in apps/web/components/editor/tag-editor.tsx
- [ ] T042 [US1] Implement OpenSearch keyword extraction Lambda in services/tag-extractor/index.ts
- [ ] T043 [US1] Create POST /api/articles/[articleId]/tags/suggest route handler in apps/web/app/api/articles/[articleId]/tags/suggest/route.ts
- [ ] T044 [US1] Create POST /api/articles route handler for composing articles in apps/web/app/api/articles/route.ts
- [ ] T045 [US1] Implement draft storage logic with S3 encryption in apps/web/lib/draft-storage.ts
- [ ] T046 [US1] Integrate draft auto-save in editor component in apps/web/components/editor/editor.tsx
- [ ] T047 [US1] Create editor page route in apps/web/app/(editor)/compose/page.tsx
- [ ] T048 [US1] Add validation for appearance settings (14-24px font, 0-64px padding) in apps/web/lib/validators/appearance.ts
- [ ] T049 [US1] Add logging for compose/edit actions with author_id and article_id in apps/web/app/api/articles/route.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - users can compose, edit, adjust appearance, and save drafts with auto-suggested tags

---

## Phase 4: User Story 2 - Import Markdown/MDX (Priority: P1)

**Goal**: Enable bloggers to import existing article files (.md or .mdx, up to 8 MB) with validation and metadata filling

**Independent Test**: Upload a compliant MDX file under 8 MB, ensure content loads with embeds, large images warn appropriately, and publish successfully

### Implementation for User Story 2

- [ ] T050 [P] [US2] Implement file size validation (≤8 MB) in packages/importer/src/validators/size-validator.ts
- [ ] T051 [P] [US2] Implement format validation (.md/.mdx only) in packages/importer/src/validators/format-validator.ts
- [ ] T052 [P] [US2] Implement MDX asset size inspection for referenced media in packages/importer/src/validators/asset-validator.ts
- [ ] T053 [US2] Create MDX parser with Contentlayer in packages/importer/src/parsers/mdx-parser.ts
- [ ] T054 [US2] Implement oversized asset warning logic in packages/importer/src/warnings/oversized-asset-warning.ts
- [ ] T055 [US2] Create import result type with warnings/errors in packages/importer/src/types/import-result.ts
- [ ] T056 [US2] Create file upload UI component with drag-drop in apps/web/components/importer/file-upload.tsx
- [ ] T057 [P] [US2] Create import validation feedback UI component in apps/web/components/importer/validation-feedback.tsx
- [ ] T058 [US2] Create POST /api/articles/import route handler in apps/web/app/api/articles/import/route.ts
- [ ] T059 [US2] Integrate importer with editor to populate TipTap state in apps/web/lib/importer-to-editor.ts
- [ ] T060 [US2] Create import page route in apps/web/app/(editor)/import/page.tsx
- [ ] T061 [US2] Implement file size warning UX per research.md decision in apps/web/components/importer/file-size-warning.tsx
- [ ] T062 [US2] Add logging for import validation failures in apps/web/app/api/articles/import/route.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can compose OR import articles

---

## Phase 5: User Story 3 - Draft, Schedule, and Publish Control (Priority: P2)

**Goal**: Enable bloggers to save private drafts, schedule publication in JST with minute precision, edit scheduled content safely, and toggle published/private status

**Independent Test**: Create a draft stored privately, schedule for a future JST time, edit before publish, receive prompts/notifications, and later unpublish the article

### Implementation for User Story 3

- [ ] T063 [P] [US3] Implement JST to UTC time conversion utilities in packages/scheduler-sdk/src/utils/timezone.ts
- [ ] T064 [P] [US3] Implement past-time validation for scheduling in packages/scheduler-sdk/src/validators/schedule-validator.ts
- [ ] T065 [P] [US3] Create BullMQ job definition for publish jobs in packages/scheduler-sdk/src/jobs/publish-job.ts
- [ ] T066 [P] [US3] Create scheduling UI component with JST datetime picker in apps/web/components/scheduler/schedule-picker.tsx
- [ ] T067 [P] [US3] Create schedule edit prompt modal component in apps/web/components/scheduler/edit-prompt.tsx
- [ ] T068 [US3] Create POST /api/articles/[articleId]/schedule route handler in apps/web/app/api/articles/[articleId]/schedule/route.ts
- [ ] T069 [US3] Implement BullMQ queue initialization with Upstash Redis in services/publisher/src/queue/publish-queue.ts
- [ ] T070 [US3] Implement publish job processor in services/publisher/src/jobs/publish-processor.ts
- [ ] T071 [US3] Implement article status transition logic (draft → scheduled → published) in services/publisher/src/services/article-service.ts
- [ ] T072 [US3] Create AWS SES email notification service in services/publisher/src/notifications/email-service.ts
- [ ] T073 [US3] Implement publish failure notification email template per research.md in services/publisher/src/notifications/templates/publish-failure.ts
- [ ] T074 [US3] Add failure notification logic to publish processor in services/publisher/src/jobs/publish-processor.ts
- [ ] T075 [US3] Implement schedule edit detection and prompt trigger in apps/web/components/editor/editor.tsx
- [ ] T076 [US3] Create POST /api/articles/[articleId]/toggle route handler for publish/private toggle in apps/web/app/api/articles/[articleId]/toggle/route.ts
- [ ] T077 [US3] Implement cache purge logic for category pages on publish/unpublish in apps/web/lib/cache/purge.ts
- [ ] T078 [US3] Add draft privacy enforcement via RLS policy validation in apps/web/lib/auth/draft-access.ts
- [ ] T079 [US3] Implement schedule confirmation UI in publish workflow in apps/web/components/scheduler/schedule-confirm.tsx
- [ ] T080 [US3] Add logging for schedule operations and notifications in services/publisher/src/jobs/publish-processor.ts
- [ ] T081 [US3] Create publish.success_rate metric emission in services/publisher/src/telemetry/metrics.ts
- [ ] T082 [US3] Create publish.failure_count metric emission in services/publisher/src/telemetry/metrics.ts

**Checkpoint**: All user stories should now be independently functional - compose, import, schedule, and publish control all work

---

## Phase 6: Category Navigation & Pagination

**Purpose**: Enable fast category navigation (Music, Movie, Tech, Blog) with paginated views showing 12 posts per page (FR-008, FR-011)

- [ ] T083 [P] Create GET /api/articles route handler with category filter in apps/web/app/api/articles/route.ts
- [ ] T084 [P] Implement pagination logic (12 posts per page) in apps/web/lib/pagination/paginator.ts
- [ ] T085 Create category page cache builder in apps/web/lib/cache/category-cache.ts
- [ ] T086 [P] Create category header navigation component in apps/web/components/navigation/category-header.tsx
- [ ] T087 [P] Create paginated article list component in apps/web/components/articles/article-list.tsx
- [ ] T088 Create category page route for Music in apps/web/app/(home)/music/page.tsx
- [ ] T089 [P] Create category page route for Movie in apps/web/app/(home)/movie/page.tsx
- [ ] T090 [P] Create category page route for Tech in apps/web/app/(home)/tech/page.tsx
- [ ] T091 [P] Create category page route for Blog in apps/web/app/(home)/blog/page.tsx
- [ ] T092 Implement ISR (revalidate=30s) for category pages in apps/web/app/(home)/[category]/page.tsx
- [ ] T093 Integrate cache purge webhook to invalidate category pages in apps/web/lib/cache/purge.ts
- [ ] T094 Add empty category state handling in apps/web/components/articles/empty-state.tsx
- [ ] T095 Implement top page with first contentful paint optimization in apps/web/app/page.tsx

**Checkpoint**: Category navigation and pagination complete - users can browse all categories with fast page loads (SC-001)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and meet success criteria

- [ ] T096 [P] Add performance monitoring for import.duration_ms metric in apps/web/app/api/articles/import/route.ts
- [ ] T097 [P] Add performance monitoring for frontend.first_paint_ms via Web Vitals in apps/web/lib/web-vitals.ts
- [ ] T098 [P] Implement draft.encryption_check_pass metric for audit logs in apps/web/lib/draft-storage.ts
- [ ] T099 [P] Add network loss handling and local draft buffer in apps/web/components/editor/editor.tsx
- [ ] T100 [P] Implement auto tag fallback for short/multilingual content in services/tag-extractor/index.ts
- [ ] T101 [P] Add DST-safe scheduling validation (JST doesn't observe DST) in packages/scheduler-sdk/src/validators/schedule-validator.ts
- [ ] T102 Create rollback runbook documentation in docs/runbooks/rollback.md
- [ ] T103 Validate quickstart.md end-to-end workflow per docs/quickstart.md
- [ ] T104 [P] Code cleanup and refactoring across all packages
- [ ] T105 [P] Security audit for XSS/injection vulnerabilities in MDX parsing and editor
- [ ] T106 Setup CloudFront CDN integration via Vercel in infra/terraform/cdn.tf
- [ ] T107 Verify <1s first paint performance target (SC-001) with k6 load tests
- [ ] T108 Verify ≥95% scheduled publish success rate (SC-003) with telemetry validation
- [ ] T109 Verify draft encryption at rest/transit (SC-002) with audit log verification
- [ ] T110 [P] Create observability dashboards for monitoring in infra/terraform/observability.tf

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Category Navigation (Phase 6)**: Depends on US3 completion (needs published articles and cache purge logic)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1) - Compose**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1) - Import**: Can start after Foundational (Phase 2) - Integrates with US1 editor but independently testable
- **User Story 3 (P2) - Schedule**: Can start after Foundational (Phase 2) - Builds on US1/US2 but independently testable

### Within Each User Story

**User Story 1 (Compose):**
- TipTap extensions (T030-T034) can run in parallel
- T035 depends on T030-T034
- T036 depends on T030-T035
- T037-T038 depend on T036
- UI components (T039-T041) can run in parallel after T036
- T042-T043 (tag extraction) can run in parallel
- T044-T045 (API routes) depend on T024, T026
- T046-T047 depend on T039, T045
- T048 depends on T039-T041, T046-T047

**User Story 2 (Import):**
- Validators (T050-T052) can run in parallel
- T053 depends on T050-T052
- T054-T055 depend on T053
- UI components (T056-T057) can run in parallel
- T058 depends on T053-T055
- T059 depends on T038, T053
- T060-T062 depend on previous tasks

**User Story 3 (Schedule):**
- Utilities/Validators (T063-T065) can run in parallel
- UI components (T066-T067) can run in parallel
- T068-T069 depend on T063-T065
- T070-T074 (worker implementation) are sequential
- T075-T082 depend on various earlier tasks

### Parallel Opportunities

**Phase 1 (Setup):**
All tasks T003-T011 can run in parallel after T001-T002

**Phase 2 (Foundational):**
- Database migrations (T013-T016) can run in parallel after T012
- Terraform configs (T018-T020) can run in parallel
- Library setup (T021-T029) can run in parallel

**Phase 3 (User Story 1):**
- TipTap extensions (T030-T034) can run in parallel
- UI components (T039-T041) can run in parallel after T036

**Phase 4 (User Story 2):**
- Validators (T050-T052) can run in parallel
- UI components (T056-T057) can run in parallel

**Phase 5 (User Story 3):**
- Utilities/Validators (T063-T065) can run in parallel
- UI components (T066-T067) can run in parallel

**Phase 6 (Category Navigation):**
- T083-T084 can run in parallel
- Category page routes (T089-T091) can run in parallel after T088

**Phase 7 (Polish):**
- Most tasks (T096-T101, T104-T106, T110) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all TipTap extensions together:
Task T030: "Create TipTap extension for headings in packages/editor/src/extensions/heading.ts"
Task T031: "Create TipTap extension for bold/italic in packages/editor/src/extensions/text-styles.ts"
Task T032: "Create TipTap extension for code blocks in packages/editor/src/extensions/code-block.ts"
Task T033: "Create TipTap extension for image embeds with size validation in packages/editor/src/extensions/image-figure.ts"
Task T034: "Create TipTap extension for video embeds with provider allowlist in packages/editor/src/extensions/video-embed.ts"

# Launch all UI components together (after editor factory is ready):
Task T039: "Create editor React component in apps/web/components/editor/editor.tsx"
Task T040: "Create appearance controls UI component in apps/web/components/editor/appearance-controls.tsx"
Task T041: "Create tag editor UI component with editable suggestions in apps/web/components/editor/tag-editor.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Compose)
4. Complete Phase 4: User Story 2 (Import)
5. **STOP and VALIDATE**: Test US1 and US2 independently
6. Deploy/demo if ready (bloggers can compose and import without scheduling)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (Compose MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (Import added!)
4. Add User Story 3 → Test independently → Deploy/Demo (Scheduling added!)
5. Add Category Navigation → Test → Deploy/Demo (Full navigation!)
6. Add Polish → Final validation → Production release
7. Each phase adds value without breaking previous functionality

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Compose)
   - Developer B: User Story 2 (Import)
   - Developer C: User Story 3 (Schedule)
3. Stories complete and integrate independently
4. Team reconvenes for Category Navigation + Polish

---

## Notes

- [P] tasks = different files, no dependencies on incomplete work
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are omitted per spec (not explicitly requested)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Performance targets (SC-001, SC-004) validated in Phase 7 polish tasks
- All encryption (SC-002) handled in Foundational phase
- Scheduled publish success rate (SC-003) tracked via telemetry in Phase 5

---

## Task Summary

**Total Tasks**: 110
- Phase 1 (Setup): 11 tasks (all complete ✓)
- Phase 2 (Foundational): 18 tasks (all complete ✓)
- Phase 3 (User Story 1): 20 tasks
- Phase 4 (User Story 2): 13 tasks
- Phase 5 (User Story 3): 20 tasks
- Phase 6 (Category Navigation): 13 tasks
- Phase 7 (Polish): 15 tasks

**Tasks by User Story**:
- User Story 1 (Compose): 20 tasks
- User Story 2 (Import): 13 tasks
- User Story 3 (Schedule): 20 tasks
- Shared/Infrastructure: 28 tasks (Phases 1-2)
- Cross-cutting: 28 tasks (Phases 6-7)

**Parallel Opportunities**: 45 tasks marked [P] can run in parallel within their phase

**MVP Scope** (Recommended): Phases 1-4 (User Stories 1 & 2) = 62 tasks
- Enables compose and import workflows
- All foundational infrastructure in place
- Independent test criteria met for US1 and US2

**Format Validation**: ✓ All tasks follow checklist format (checkbox, ID, labels, file paths)
