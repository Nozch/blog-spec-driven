# Implementation Plan: Personal Blog Publishing Flow

**Branch**: `001-sample` | **Date**: 2025-11-12 (Updated) | **Spec**: `specs/001-sample/spec.md`
**Input**: Feature specification from `/specs/001-sample/spec.md`

## Summary

Deliver a React-based publishing surface that lets solo bloggers compose posts in-browser, import `.md/.mdx` manuscripts, schedule releases in JST, and manage category navigation (Music, Movie, Tech, Blog) with pagination.

We will build on Next.js 14 (App Router) with a shared API layer for import validation, encrypted draft storage on S3, job scheduling via a Node worker, and an embeddings-powered keyword extractor for tag suggestions. Observability hooks, failure notifications, and under-one-second first paint are treated as first-class acceptance criteria per the spec and constitution.

## Technical Context

**Language/Version**: TypeScript 5.6 + React 18 (Next.js 14 App Router)
**Primary Dependencies**: Next.js 14, TipTap 2 editor, Contentlayer/MDX bundler, AWS SDK v3, BullMQ + Redis for scheduling, OpenSearch keyword extraction lambda
**Storage**: Supabase Postgres (article metadata + scheduling) + AWS S3 private buckets for draft blobs and media assets (server-side encryption SSE-S3)
**Testing**: Vitest (unit), Playwright (E2E), Pact (Next.js route handler contracts), k6 for first-paint perf probes
**Target Platform**: Web (Next.js SSR deployed to Vercel) with background workers on AWS Lambda + Redis (Upstash) in ap-northeast-1 (aligns with JST)
**Project Type**: Web monorepo (`apps/web` + supporting packages)
**Performance Goals**: Top page First Contentful Paint < 1 s @ 95th percentile; MD/MDX import parse/render ≤ 5 s @ 95th; cache purge on unpublish ≤ 60 s
**Constraints**: 8 MB limit for `.md/.mdx` and referenced images; drafts must stay private & encrypted; scheduling locked to JST minute precision; browser UI must expose font-size + left-padding controls; auto-tag suggestions editable; header shows four fixed categories with pagination
**Scale/Scope**: 1 active author persona today, roadmap for ≤10 concurrent authors; expect ≤10k stored posts, ≤1k daily views, but design API/stateless layers to scale linearly

## Constitution Check

*Gate evaluation aligned with Constitution v1.0.0 (ratified 2025-11-12)*

- **P1 Specification-First Source of Truth**: ✅ Spec at `specs/001-sample/spec.md` defines three independent stories, measurable success criteria, and detailed edge cases. This plan references spec revision dated 2025-11-07 and no work proceeds without spec updates.

- **P2 Independent Value Slices**: ✅ Each story (Compose, Import, Scheduling) maps to discrete components (editor package, import pipeline, scheduler worker). Shared modules (Article entity, auth) are identified and will expose story-scoped APIs to keep tasks independent. No cross-story coupling expected; any future coupling will be logged in Complexity Tracking.

- **P3 Evidence-Driven Development**: ✅ Test strategy enumerated in Technical Context. Test-first approach demonstrated with T030 (Heading extension) implementation. For every story we add contract tests (Next.js route handlers), Playwright flows, and unit tests. Failing tests are mandated before implementation per development workflow.

- **P4 Plan-to-Code Traceability**: ✅ Repository layout below maps spec requirements to concrete directories (`apps/web/app/(editor)`, `packages/editor`, `services/publisher`). Each artifact (plan, research, data-model, contracts, quickstart, tasks) references these paths so reviewers can trace requirement → plan → file path. Task T030 demonstrates traceability with exact file paths.

- **P5 Operational Simplicity & Observability**: ✅ Performance targets, logging/metrics (see spec OR-001/002) and rollback steps (feature flag, purge jobs) are documented. Scheduling worker lives in same repo to simplify deploys, and instrumentation will emit `publish.success_rate` and failure email notifications per SC-003.

**Gate status**: PASS — proceed with implementation.

**Progress Update (2025-11-12)**:
- ✅ T030 completed: Heading extension implemented with TDD approach
- ✅ Foundational setup (T001-T029) complete
- 🔄 User Story 1 in progress (T030-T049)

## Project Structure

### Documentation (this feature)

```text
specs/001-sample/
├── plan.md              # This file (updated 2025-11-12)
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 domain model
├── quickstart.md        # Phase 1 runbook
├── contracts/           # Phase 1 OpenAPI + schemas
├── checklists/          # Quality validation checklists
│   └── requirements-quality.md
└── tasks.md             # Phase 2 implementation tasks (110 tasks)
```

### Source Code (repository root)

```text
apps/
└── web/                     # Next.js 14 front-end + API routes
    ├── app/
    │   ├── (home)/          # Top page + category pagination
    │   ├── (editor)/        # Browser composer + import UI
    │   └── api/             # Route handlers for articles/import/scheduler hooks
    ├── components/
    ├── lib/                 # Shared client utilities (tag suggestions, formatting)
    ├── styles/
    └── tests/               # Playwright scenarios + visual regressions

packages/
├── editor/                  # ✅ TipTap extensions (T030 complete)
│   ├── src/
│   │   ├── extensions/      # Modular extension architecture
│   │   │   ├── heading.ts  # ✅ Implemented (T030)
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   │   ├── heading-extension.spec.ts  # ✅ 13 tests passing
│   │   │   └── ...
│   │   ├── editor.ts
│   │   └── index.ts
│   └── package.json
├── importer/                # MD/MDX validation + asset inspection logic
└── scheduler-sdk/           # Shared types and client for publish jobs

services/
└── publisher/               # Node 18 worker (BullMQ) processing schedule queue
    ├── src/
    │   ├── jobs/
    │   ├── notifications/
    │   └── telemetry/
    └── tests/               # Jest + contract tests

infra/
└── terraform/               # S3 buckets, Supabase config, Upstash Redis, feature flags
```

**Structure Decision**: Use a single Next.js app for UI + API while isolating heavy logic into packages (`editor`, `importer`, `scheduler-sdk`) to reuse between SSR routes and the publisher worker. Background scheduling sits in `services/publisher` to honor P2 independence and P5 deployability.

**Implementation Architecture**:
- **Extension Modularity** (T030-T035): Each TipTap extension lives in a separate file for independent testing and maintenance
- **Test-First Approach**: T030 demonstrates Red-Green-Refactor cycle with 13 comprehensive tests
- **Type Safety**: Full TypeScript coverage with proper type exports

## Complexity Tracking

No constitution violations identified; table not required.

## Implementation Status

### Phase 1: Setup (Complete ✓)
- T001-T011: Project structure, TypeScript config, environment setup

### Phase 2: Foundational (Complete ✓)
- T012-T029: Database schema, infrastructure, shared types, telemetry

### Phase 3: User Story 1 - Compose & Edit (In Progress)
- ✅ T030: Heading extension (completed 2025-11-12)
- ✅ T031: Text styles extension (completed 2025-11-12)
- ✅ T032: Code block extension (completed 2025-11-12)
- 🔄 T033-T049: Remaining editor extensions and UI components

### Phase 4: User Story 2 - Import (Pending)
- T050-T062: MD/MDX import pipeline

### Phase 5: User Story 3 - Schedule & Publish (Pending)
- T063-T082: Scheduling, notifications, state management

### Phase 6: Category Navigation (Pending)
- T083-T095: Pagination and category pages

### Phase 7: Polish (Pending)
- T096-T110: Performance validation, security audit, observability

**Next Steps**:
1. Continue with T031-T035 (remaining TipTap extensions)
2. Implement editor factory and serializers (T036-T038)
3. Build React components and API routes (T039-T049)

**References**:
- Constitution: `.specify/memory/constitution.md` (v1.0.0)
- Tasks: `specs/001-sample/tasks.md` (110 tasks total)
- Spec: `specs/001-sample/spec.md` (3 user stories, P1/P1/P2)
