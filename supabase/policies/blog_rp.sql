BEGIN;

-- Helper to detect Supabase service_role JWTs for worker access
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(auth.jwt() ->> 'role', '') = 'service_role';
$$;

COMMENT ON FUNCTION public.is_service_role()
    IS 'Returns true when the current JWT was signed with the Supabase service_role key.';

-- Ensure row level security is enforced for every table used by the blog feature set
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.draft_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_storage FORCE ROW LEVEL SECURITY;

ALTER TABLE public.publish_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

-- Articles: authors can manage their own rows
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'articles'
          AND polname = 'articles_select_own'
    ) THEN
        CREATE POLICY articles_select_own
            ON public.articles
            FOR SELECT
            USING (auth.uid() = author_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'articles'
          AND polname = 'articles_insert_own'
    ) THEN
        CREATE POLICY articles_insert_own
            ON public.articles
            FOR INSERT
            WITH CHECK (auth.uid() = author_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'articles'
          AND polname = 'articles_update_own'
    ) THEN
        CREATE POLICY articles_update_own
            ON public.articles
            FOR UPDATE
            USING (auth.uid() = author_id)
            WITH CHECK (auth.uid() = author_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'articles'
          AND polname = 'articles_delete_own'
    ) THEN
        CREATE POLICY articles_delete_own
            ON public.articles
            FOR DELETE
            USING (auth.uid() = author_id);
    END IF;
END $$;

-- Draft storage: always tied back to owning article/author
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'draft_storage'
          AND polname = 'draft_storage_select_own'
    ) THEN
        CREATE POLICY draft_storage_select_own
            ON public.draft_storage
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.articles a
                    WHERE a.id = draft_storage.article_id
                      AND a.author_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'draft_storage'
          AND polname = 'draft_storage_write_own'
    ) THEN
        CREATE POLICY draft_storage_write_own
            ON public.draft_storage
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.articles a
                    WHERE a.id = draft_storage.article_id
                      AND a.author_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.articles a
                    WHERE a.id = draft_storage.article_id
                      AND a.author_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Publish jobs: authors can read their jobs, worker (service_role) mutates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'publish_jobs'
          AND polname = 'publish_jobs_select_own'
    ) THEN
        CREATE POLICY publish_jobs_select_own
            ON public.publish_jobs
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.articles a
                    WHERE a.id = publish_jobs.article_id
                      AND a.author_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'publish_jobs'
          AND polname = 'publish_jobs_insert_author'
    ) THEN
        CREATE POLICY publish_jobs_insert_author
            ON public.publish_jobs
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.articles a
                    WHERE a.id = publish_jobs.article_id
                      AND a.author_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'publish_jobs'
          AND polname = 'publish_jobs_delete_author'
    ) THEN
        CREATE POLICY publish_jobs_delete_author
            ON public.publish_jobs
            FOR DELETE
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.articles a
                    WHERE a.id = publish_jobs.article_id
                      AND a.author_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'publish_jobs'
          AND polname = 'publish_jobs_worker_update'
    ) THEN
        CREATE POLICY publish_jobs_worker_update
            ON public.publish_jobs
            FOR UPDATE
            USING (public.is_service_role())
            WITH CHECK (TRUE);
    END IF;
END $$;

-- Notifications: authors read, worker writes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notifications'
          AND polname = 'notifications_select_author'
    ) THEN
        CREATE POLICY notifications_select_author
            ON public.notifications
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.articles a
                    WHERE a.id = notifications.article_id
                      AND a.author_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notifications'
          AND polname = 'notifications_worker_manage'
    ) THEN
        CREATE POLICY notifications_worker_manage
            ON public.notifications
            FOR ALL
            USING (public.is_service_role())
            WITH CHECK (public.is_service_role());
    END IF;
END $$;

-- RPC helper: fetch draft metadata for an author's article
CREATE OR REPLACE FUNCTION public.fn_get_author_draft(p_article_id UUID)
RETURNS TABLE (
    article_id UUID,
    s3_key TEXT,
    checksum TEXT,
    uploaded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    SELECT ds.article_id,
           ds.s3_key,
           ds.checksum,
           ds.uploaded_at,
           ds.expires_at
    FROM public.draft_storage ds
    JOIN public.articles a ON a.id = ds.article_id
    WHERE ds.article_id = p_article_id
      AND a.author_id = auth.uid();
$$;

COMMENT ON FUNCTION public.fn_get_author_draft(UUID)
    IS 'Returns draft storage metadata for the calling author; NULL result means no access.';

-- RPC helper: upsert draft storage entry scoped to author ownership
CREATE OR REPLACE FUNCTION public.fn_upsert_author_draft(
    p_article_id UUID,
    p_s3_key TEXT,
    p_checksum TEXT,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.draft_storage
LANGUAGE plpgsql
AS $$
DECLARE
    v_author UUID;
    v_result public.draft_storage;
BEGIN
    SELECT author_id INTO v_author
    FROM public.articles
    WHERE id = p_article_id;

    IF v_author IS NULL THEN
        RAISE EXCEPTION 'Article % was not found', p_article_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_author <> auth.uid() THEN
        RAISE EXCEPTION 'Permission denied for article %', p_article_id
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.draft_storage (article_id, s3_key, checksum, expires_at)
    VALUES (p_article_id, p_s3_key, p_checksum, p_expires_at)
    ON CONFLICT (article_id) DO UPDATE
        SET s3_key = EXCLUDED.s3_key,
            checksum = EXCLUDED.checksum,
            expires_at = EXCLUDED.expires_at,
            uploaded_at = timezone('utc', now())
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_upsert_author_draft(UUID, TEXT, TEXT, TIMESTAMPTZ)
    IS 'Creates or updates draft storage rows but only when the caller owns the backing article.';

COMMIT;
