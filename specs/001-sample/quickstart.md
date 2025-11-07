# Quickstart: Personal Blog Publishing Flow

## Prerequisites
- Node.js 20.11+
- pnpm 9+
- Supabase project (Postgres + Auth) with RLS enabled
- AWS account with S3 bucket `blog-drafts-{env}` and SES verified sender
- Upstash Redis (or self-hosted Redis 7+) in ap-northeast-1
- Vercel project for deploying `apps/web`

## 1. Install & Bootstrap
```bash
pnpm install
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <ref>
```

## 2. Environment Variables (`.env.local`)
```
NEXT_PUBLIC_BASE_URL=https://localhost:3000
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE=...
S3_DRAFT_BUCKET=blog-drafts-dev
AWS_REGION=ap-northeast-1
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
OPENSEARCH_ENDPOINT=...
SES_SENDER=notify@blog.example.com
```

## 3. Database & Storage
```bash
pnpm supabase db push          # Applies Article/Draft/PublishJob schema
aws s3api create-bucket --bucket $S3_DRAFT_BUCKET --region ap-northeast-1 --create-bucket-configuration LocationConstraint=ap-northeast-1
aws s3api put-bucket-encryption --bucket $S3_DRAFT_BUCKET --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

## 4. Run Dev Servers
```bash
pnpm --filter apps/web dev      # Next.js editor + API routes
pnpm --filter services/publisher dev  # BullMQ worker (runs with ts-node)
```

## 5. Testing & Quality Gates
```bash
pnpm test                       # Jest unit + contract tests
pnpm playwright test            # Story-level E2E flows
pnpm k6 run perf/first-paint.js # Perf guardrail for SC-001
```

## 6. Scheduling Workflow
1. Create an article (`/compose`).
2. Hit “Schedule” and pick a future JST timestamp (UI prevents past dates).
3. BullMQ worker (services/publisher) processes jobs, publishes articles, purges caches, and sends SES emails on failure.

## 7. Deployment
```bash
pnpm run build                  # Next.js + packages
vercel deploy --prod            # apps/web
pnpm --filter services/publisher deploy # Serverless deploy to AWS Lambda
```
Feature flag `personal-blog-publishing` gates rollout. Disable flag + redeploy previous stable build to rollback.
