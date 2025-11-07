# Data Model: Personal Blog Publishing Flow

## Article
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | Primary key shared across drafts/published versions |
| author_id | UUID | Yes | Must match authenticated user; enforced via RLS |
| title | string (1-120 chars) | Yes | Validated for profanity + uniqueness per author |
| body_mdx | text | Yes | Canonical MDX source (≤ 8 MB) |
| body_tiptap | jsonb | Yes | TipTap document tree for editor restore |
| tags | text[] | Yes | Auto-suggested list editable by user; min 1 before publish |
| category | enum(`music`,`movie`,`tech`,`blog`) | Yes | Drives header navigation |
| status | enum(`draft`,`scheduled`,`published`,`private`) | Yes | `private` represents unpublished toggle |
| appearance | jsonb { font_size:number, left_padding:number } | Yes | Font size 14–24px, padding 0–64px |
| scheduled_time | timestamptz nullable | No | Stored in UTC; must be >= now() when status = scheduled |
| published_at | timestamptz nullable | No | Set when status transitions to published |
| created_at | timestamptz | Yes | Defaults to now() |
| updated_at | timestamptz | Yes | Updated on write |

**Relationships**
- `Article` 1:N `PublishJob` (history of attempts)
- `Article` 1:1 `DraftStorage` (latest encrypted blob reference)

**State transitions**
```
draft --schedule--> scheduled --worker success--> published --toggle--> private
private --republish--> scheduled/published
scheduled --cancel--> draft
```
All transitions require audit logging + notifications per FR-010.

## DraftStorage
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| article_id | UUID | Yes | FK references Article.id |
| s3_key | string | Yes | Points to encrypted object (`drafts/{author}/{article}.json`) |
| checksum | string | Yes | SHA-256 of stored blob for tamper detection |
| uploaded_at | timestamptz | Yes | When draft stored |
| expires_at | timestamptz | No | Optional TTL for orphan cleanup |

**Rules**
- Access allowed only for matching `author_id` (verified via Article join + signed URL)
- Versioning handled by overwriting object; previous versions captured via S3 object versioning if enabled.

## PublishJob
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | Job identifier (BullMQ jobId) |
| article_id | UUID | Yes | FK to Article |
| scheduled_time | timestamptz | Yes | UTC equivalent of requested JST time |
| status | enum(`pending`,`running`,`success`,`failure`) | Yes | Mirrors worker lifecycle |
| failure_reason | text | No | Present when status = failure |
| notified_at | timestamptz | No | Last time failure email sent |
| metadata | jsonb | No | Stores worker diagnostic info |

**Rules**
- Unique constraint on (`article_id`, `scheduled_time`) prevents duplicate jobs
- Worker updates `status` atomically; failures enqueue retry + trigger email notification.

## CategoryPage Cache Snapshot
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| category | enum | Yes | Music/Movie/Tech/Blog |
| page | integer | Yes | 1-indexed |
| article_ids | uuid[] | Yes | Sorted by publish date desc |
| generated_at | timestamptz | Yes | For TTL enforcement |

**Usage**
- Stored in Edge KV (or Postgres mat view) to back pagination API with <1 s latency
- Invalidated via webhook when articles are published/unpublished within that category.

## Notifications
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | |
| article_id | UUID | Yes | |
| type | enum(`schedule_prompt`,`publish_failure`) | Yes | |
| channel | enum(`in_app`,`email`) | Yes | |
| sent_at | timestamptz | Yes | |
| payload | jsonb | Yes | Stores message copy + CTA |

Provides audit trail for FR-010 (schedule prompts) and FR-006 (failure emails).
