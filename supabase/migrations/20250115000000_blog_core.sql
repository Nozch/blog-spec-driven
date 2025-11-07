BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enumerations derived from spec data model
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_category') THEN
        CREATE TYPE article_category AS ENUM ('music', 'movie', 'tech', 'blog');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_status') THEN
        CREATE TYPE article_status AS ENUM ('draft', 'scheduled', 'published', 'private');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publish_job_status') THEN
        CREATE TYPE publish_job_status AS ENUM ('pending', 'running', 'success', 'failure');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM ('schedule_prompt', 'publish_failure');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
        CREATE TYPE notification_channel AS ENUM ('in_app', 'email');
    END IF;
END $$;

-- Articles capture core metadata + appearance controls
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL,
    title VARCHAR(120) NOT NULL,
    body_mdx TEXT NOT NULL,
    body_tiptap JSONB NOT NULL,
    tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    category article_category NOT NULL,
    status article_status NOT NULL DEFAULT 'draft',
    appearance JSONB NOT NULL,
    scheduled_time TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT title_length CHECK (char_length(title) BETWEEN 1 AND 120),
    CONSTRAINT tags_required_for_publish CHECK (
        status IN ('draft', 'private')
        OR array_length(tags, 1) IS NOT NULL
    ),
    CONSTRAINT appearance_valid CHECK (
        jsonb_typeof(appearance) = 'object'
        AND jsonb_typeof(appearance -> 'font_size') = 'number'
        AND jsonb_typeof(appearance -> 'left_padding') = 'number'
        AND ((appearance ->> 'font_size')::numeric BETWEEN 14 AND 24)
        AND ((appearance ->> 'left_padding')::numeric BETWEEN 0 AND 64)
    ),
    CONSTRAINT scheduled_time_required CHECK (
        status != 'scheduled'
        OR (
            scheduled_time IS NOT NULL
            AND scheduled_time > timezone('utc', now())
        )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS articles_author_title_unique
    ON public.articles (author_id, lower(title));

CREATE INDEX IF NOT EXISTS idx_articles_author_status
    ON public.articles (author_id, status);

CREATE INDEX IF NOT EXISTS idx_articles_category_status_published
    ON public.articles (category, status, published_at DESC NULLS LAST);

-- Draft storage references encrypted S3 objects per article
CREATE TABLE IF NOT EXISTS public.draft_storage (
    article_id UUID PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
    s3_key TEXT NOT NULL,
    checksum TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_draft_storage_expires
    ON public.draft_storage (expires_at)
    WHERE expires_at IS NOT NULL;

-- Publish jobs back scheduling worker with audit metadata
CREATE TABLE IF NOT EXISTS public.publish_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMPTZ NOT NULL,
    status publish_job_status NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    notified_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT publish_jobs_unique_schedule UNIQUE (article_id, scheduled_time)
);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_article_status
    ON public.publish_jobs (article_id, status);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_due
    ON public.publish_jobs (status, scheduled_time);

-- Notifications table records schedule prompts + failure emails
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    channel notification_channel NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_article_type
    ON public.notifications (article_id, type);

CREATE INDEX IF NOT EXISTS idx_notifications_sent_at
    ON public.notifications (sent_at DESC);

-- Helper trigger to maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_articles_updated_at'
    ) THEN
        CREATE TRIGGER set_articles_updated_at
        BEFORE UPDATE ON public.articles
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_publish_jobs_updated_at'
    ) THEN
        CREATE TRIGGER set_publish_jobs_updated_at
        BEFORE UPDATE ON public.publish_jobs
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

COMMIT;
