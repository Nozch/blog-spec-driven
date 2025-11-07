# Implementation Plan: Personal Blog Publishing Flow

**Branch**: `001-sample` | **Date**: 2025-11-07 | **Spec**: `specs/001-sample/spec.md`
**Input**: Feature specification from `/specs/001-sample/spec.md`

## Summary

Deliver a React-based publishing surface that lets solo bloggers compose posts in-browser, import `.md/.mdx` manuscripts, schedule releases in JST, and manage category navigation (Music, Movie, Tech, Blog) with pagination.  
We will build on Next.js 14 (App Router) with a shared API layer for import validation, encrypted draft storage on S3, job scheduling via a Node worker, and an embeddings-powered keyword extractor for tag suggestions. Observability hooks, failure notifications, and under-one-second first paint are treated as first-class acceptance criteria per the spec and constitution.

## Technical Context

**Language/Version**: TypeScript 5.6 + React 18 (Next.js 14 App Router)  
**Primary Dependencies**: Next.js 14, TipTap 2 editor, Contentlayer/MDX bundler, AWS SDK v3, BullMQ + Redis for scheduling, OpenSearch keyword extraction lambda  
**Storage**: Supabase Postgres (article metadata + scheduling) + AWS S3 private buckets for draft blobs and media assets (server-side encryption SSE-S3)  
**Testing**: Jest + React Testing Library (unit), Playwright (E2E), Pact (Next.js route handler contracts), k6 for first-paint perf probes  
**Target Platform**: Web (Next.js SSR deployed to Vercel) with background workers on AWS Lambda + Redis (Upstash) in ap-northeast-1 (aligns with JST)  
**Project Type**: Web monorepo (`apps/web` + supporting packages)  
**Performance Goals**: Top page First Contentful Paint < 1 s @ 95th percentile; MD/MDX import parse/render ≤ 5 s @ 95th; cache purge on unpublish ≤ 60 s  
**Constraints**: 8 MB limit for `.md/.mdx` and referenced images; drafts must stay private & encrypted; scheduling locked to JST minute precision; browser UI must expose font-size + left-padding controls; auto-tag suggestions editable; header shows four fixed categories with pagination  
**Scale/Scope**: 1 active author persona today, roadmap for ≤10 concurrent authors; expect ≤10k stored posts, ≤1k daily views, but design API/stateless layers to scale linearly

## Constitution Check

*Gate evaluation prior to Phase 0 research*

- **P1 Specification-First Source of Truth**: ✅ Spec at `specs/001-sample/spec.md` defines three independent stories, measurable success criteria, and detailed edge cases. This plan references spec revision dated 2025-11-07 and no work proceeds without spec updates.
- **P2 Independent Value Slices**: ✅ Each story (Compose, Import, Scheduling) maps to discrete components (editor package, import pipeline, scheduler worker). Shared modules (Article entity, auth) are identified and will expose story-scoped APIs to keep tasks independent. No cross-story coupling expected; any future coupling will be logged in Complexity Tracking.
- **P3 Evidence-Driven Development**: ✅ Test strategy enumerated in Technical Context. For every story we will add contract tests (Next.js route handlers), Playwright flows, and unit tests. Failing tests are mandated before implementation per development workflow.
- **P4 Plan-to-Code Traceability**: ✅ Repository layout below maps spec requirements to concrete directories (`apps/web/app/(editor)`, `packages/editor`, `services/publisher`). Each artifact (plan, research, data-model, contracts, quickstart) references these paths so reviewers can trace requirement → plan → file path.
- **P5 Operational Simplicity & Observability**: ✅ Performance targets, logging/metrics (see spec OR-001/002) and rollback steps (feature flag, purge jobs) are documented. Scheduling worker lives in same repo to simplify deploys, and instrumentation will emit `publish.success_rate` and failure email notifications per SC-003.

Gate status: PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-sample/
├── plan.md          # This file
├── research.md      # Phase 0 decisions
├── data-model.md    # Phase 1 domain model
├── quickstart.md    # Phase 1 runbook
├── contracts/       # Phase 1 OpenAPI + schemas
└── tasks.md         # Phase 2 (generated later)
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
├── editor/                  # TipTap extensions for embeds + appearance controls
├── importer/                # MD/MDX validation + asset inspection logic
└── scheduler-sdk/           # Shared types and client for publish jobs

services/
└── publisher/               # Node 18 worker (BullMQ) processing schedule queue, emailing failures
    ├── src/
    │   ├── jobs/
    │   ├── notifications/
    │   └── telemetry/
    └── tests/               # Jest + contract tests for queue + email logic

infra/
└── terraform/               # S3 buckets, Supabase config, Upstash Redis credentials, feature flags
```

**Structure Decision**: Use a single Next.js app for UI + API while isolating heavy logic into packages (`editor`, `importer`, `scheduler-sdk`) to reuse between SSR routes and the publisher worker. Background scheduling sits in `services/publisher` to honor P2 independence and P5 deployability.

## Complexity Tracking

No constitution violations identified; table not required.
