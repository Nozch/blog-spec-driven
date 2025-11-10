/**
 * Shared scheduler SDK for articles and publish jobs.
 * Source of truth: specs/001-sample/spec.md & data-model.md
 */

export type IsoDateString = string;

export type ArticleCategory = 'music' | 'movie' | 'tech' | 'blog';
export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'private';
export type PublishJobStatus = 'pending' | 'running' | 'success' | 'failure';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ArticleAppearance {
  fontSize: number; // 14–24 inclusive
  leftPadding: number; // 0–64 inclusive
}

export interface Article {
  id: string;
  authorId: string;
  title: string;
  bodyMdx: string;
  bodyTipTap: JsonValue;
  tags: string[];
  category: ArticleCategory;
  status: ArticleStatus;
  appearance: ArticleAppearance;
  scheduledTimeJst: IsoDateString | null;
  publishedAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface PublishJob {
  id: string;
  articleId: string;
  scheduledTimeJst: IsoDateString;
  status: PublishJobStatus;
  failureReason?: string | null;
  notifiedAt?: IsoDateString | null;
  metadata?: JsonValue;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string | null;
  previousCursor?: string | null;
  total?: number;
}

export interface CreateArticlePayload {
  title: string;
  bodyMdx: string;
  bodyTipTap: JsonValue;
  tags: string[];
  category: ArticleCategory;
  appearance: ArticleAppearance;
  status?: ArticleStatus;
  scheduledTimeJst?: IsoDateString | null;
}

export type UpdateArticlePayload = Partial<CreateArticlePayload>;

export interface ScheduleArticlePayload {
  scheduledTimeJst: IsoDateString; // must be future JST instant per API
  timezone?: string; // e.g., 'UTC' | 'Asia/Tokyo'
  note?: string;
}

export interface ListArticlesParams {
  status?: ArticleStatus;
  category?: ArticleCategory;
  authorId?: string;
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface ListPublishJobsParams {
  articleId?: string;
  status?: PublishJobStatus;
  limit?: number;
  cursor?: string;
}

export interface UpdatePublishJobPayload {
  status: PublishJobStatus;
  failureReason?: string | null;
  metadata?: JsonValue;
  notifiedAt?: IsoDateString | null;
}

export interface SchedulerClientOptions {
  /**
   * Base URL for API routes (must include the `/api` prefix),
   * e.g. https://app.example.com/api
   */
  baseUrl: string;
  /**
   * Custom fetch implementation. Defaults to globalThis.fetch.
   */
  fetch?: typeof fetch;
  /**
   * Headers applied to every request (e.g., auth token).
   */
  defaultHeaders?: HeadersInit;
  /**
   * Injectable clock for deterministic testing.
   */
  now?: () => Date;
}

export class SchedulerSdkError extends Error {}

export class ValidationError extends SchedulerSdkError {}

export class ApiError extends SchedulerSdkError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export class SchedulerClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: HeadersInit;
  private readonly now: () => Date;

  constructor(options: SchedulerClientOptions) {
    if (!options.baseUrl) {
      throw new ValidationError('baseUrl is required');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(options.baseUrl);
    } catch (error) {
      throw new ValidationError(
        `Invalid baseUrl "${options.baseUrl}": ${(error as Error).message}`,
      );
    }

    const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, '');
    if (!normalizedPathname.startsWith('/api')) {
      throw new ValidationError(
        'baseUrl path must start with "/api" (e.g., https://app.example.com/api or https://app.example.com/api/v1)',
      );
    }
    const normalizedBaseUrl = `${parsedUrl.origin}${normalizedPathname}`;

    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new SchedulerSdkError(
        'No fetch implementation available. Provide options.fetch when running outside environments with global fetch.',
      );
    }

    this.baseUrl = normalizedBaseUrl;
    this.fetchImpl = fetchImpl;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.now = options.now ?? (() => new Date());
  }

  async getArticle(id: string): Promise<Article> {
    this.assertId('articleId', id);
    return this.request<Article>(`articles/${id}`);
  }

  async listArticles(
    params: ListArticlesParams = {},
  ): Promise<PaginatedResult<Article>> {
    const query = this.cleanQuery({
      status: params.status,
      category: params.category,
      authorId: params.authorId,
      limit: params.limit,
      cursor: params.cursor,
      search: params.search,
    });
    return this.request<PaginatedResult<Article>>('articles', {
      query,
    });
  }

  async createArticle(payload: CreateArticlePayload): Promise<Article> {
    this.assertArticlePayload(payload);
    return this.request<Article>('articles', {
      method: 'POST',
      body: payload,
    });
  }

  async updateArticle(
    id: string,
    payload: UpdateArticlePayload,
  ): Promise<Article> {
    this.assertId('articleId', id);
    if (payload.appearance) {
      this.assertAppearance(payload.appearance);
    }
    if (payload.scheduledTimeJst !== undefined && payload.scheduledTimeJst !== null) {
      this.assertFutureInstant(payload.scheduledTimeJst);
    }
    return this.request<Article>(`articles/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  async scheduleArticle(
    articleId: string,
    payload: ScheduleArticlePayload,
  ): Promise<void> {
    this.assertId('articleId', articleId);
    this.assertFutureInstant(payload.scheduledTimeJst);

    return this.request<void>(`articles/${articleId}/schedule`, {
      method: 'POST',
      body: payload,
    });
  }

  async listPublishJobs(
    params: ListPublishJobsParams = {},
  ): Promise<PaginatedResult<PublishJob>> {
    const query = this.cleanQuery({
      articleId: params.articleId,
      status: params.status,
      limit: params.limit,
      cursor: params.cursor,
    });
    return this.request<PaginatedResult<PublishJob>>('publish-jobs', {
      query,
    });
  }

  async updatePublishJob(
    id: string,
    payload: UpdatePublishJobPayload,
  ): Promise<PublishJob> {
    this.assertId('publishJobId', id);
    return this.request<PublishJob>(`publish-jobs/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  private async request<T>(
    path: string,
    init: {
      method?: string;
      body?: unknown;
      headers?: HeadersInit;
      query?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const url = this.buildUrl(path, init.query);
    const finalInit: RequestInit = {
      method: init.method ?? 'GET',
      headers: this.mergeHeaders(init.headers, init.body),
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    };

    const response = await this.fetchImpl(url, finalInit);
    const raw = await response.text();
    const data = this.safeJsonParse(raw);

    if (!response.ok) {
      throw new ApiError(
        `Request to ${url} failed with status ${response.status}`,
        response.status,
        data,
      );
    }

    return data as T;
  }

  private mergeHeaders(
    headers?: HeadersInit,
    body?: unknown,
  ): Headers {
    const merged = new Headers(this.defaultHeaders);
    if (headers) {
      new Headers(headers).forEach((value, key) => {
        merged.set(key, value);
      });
    }

    if (body !== undefined && !merged.has('content-type')) {
      merged.set('content-type', 'application/json');
    }

    return merged;
  }

  private buildUrl(path: string, query?: Record<string, string>): string {
    const normalizedPath = path.startsWith('/')
      ? path.slice(1)
      : path;
    const url = new URL(`${this.baseUrl}/${normalizedPath}`);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, value);
        }
      });
    }

    return url.toString();
  }

  private cleanQuery(
    params: Record<string, string | number | undefined>,
  ): Record<string, string> | undefined {
    const entries = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]);

    return entries.length ? Object.fromEntries(entries) : undefined;
  }

  private safeJsonParse(raw: string): unknown {
    if (!raw) {
      return undefined;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  private assertArticlePayload(payload: CreateArticlePayload): void {
    if (!payload.title?.trim()) {
      throw new ValidationError('title is required');
    }
    if (!payload.bodyMdx?.trim()) {
      throw new ValidationError('bodyMdx is required');
    }
    if (!payload.bodyTipTap) {
      throw new ValidationError('bodyTipTap is required');
    }
    if (!payload.tags?.length) {
      throw new ValidationError('tags must include at least one entry');
    }
    if (!payload.appearance) {
      throw new ValidationError('appearance is required');
    }
    this.assertAppearance(payload.appearance);
    if (payload.scheduledTimeJst !== undefined && payload.scheduledTimeJst !== null) {
      this.assertFutureInstant(payload.scheduledTimeJst);
    }
  }

  private assertAppearance(appearance: ArticleAppearance): void {
    const { fontSize, leftPadding } = appearance;
    if (!Number.isFinite(fontSize) || fontSize < 14 || fontSize > 24) {
      throw new ValidationError(
        `fontSize must be between 14 and 24. Received ${fontSize}`,
      );
    }
    if (!Number.isFinite(leftPadding) || leftPadding < 0 || leftPadding > 64) {
      throw new ValidationError(
        `leftPadding must be between 0 and 64. Received ${leftPadding}`,
      );
    }
  }

  private assertFutureInstant(iso: IsoDateString): void {
    const instant = new Date(iso);
    if (Number.isNaN(instant.getTime())) {
      throw new ValidationError(`Invalid ISO timestamp: ${iso}`);
    }
    if (instant.getTime() <= this.now().getTime()) {
      throw new ValidationError(
        'scheduledTimeJst must be a future JST instant per spec requirement.',
      );
    }
  }

  private assertId(field: string, value: string): void {
    if (!value || typeof value !== 'string') {
      throw new ValidationError(`${field} must be a non-empty string`);
    }
  }
}

export * from './telemetry.js';
