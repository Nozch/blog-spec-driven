# Feature Specification: Personal Blog Publishing Flow

**Feature Branch**: `001-sample`  
**Created**: 2025-11-07  
**Status**: Draft  
**Input**: User description: “Enable individual bloggers to publish and manage posts with fast category navigation, dual authoring modes, appearance controls, auto tag suggestions, and scheduling.”

**Constitution Link**: Per P1 Specification-First Source of Truth, this spec is the binding reference for downstream plans and tasks. Do not move to planning until every mandatory section below is complete and reviewed.

## Clarifications

### Session 2025-11-07
- Q: How many articles should each category page list per pagination step? → A: 12 posts per page

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compose & Edit In-Browser (Priority: P1)

An individual blogger writes and edits an article directly in the browser with formatting controls, appearance adjustments, and auto-suggested tags before publishing or saving as draft.

**Why this priority**: Core authoring workflow; without it, no content can be created when away from local files.

**Independent Test**: Create a full article using only the browser UI, adjust font size/padding, edit suggested tags, and publish without importing files.

**Acceptance Scenarios**:

1. **Scenario: Format controls render in editor**  
   **Given** I am composing a new article in the browser editor  
   **When** I apply headings, bold, italic, code block, image, and video embeds  
   **Then** the preview reflects the formatting and the content saves with those blocks.

2. **Scenario: Appearance adjustments**  
   **Given** I am editing appearance settings  
   **When** I change font size and left padding  
   **Then** the editor preview updates immediately and the saved article renders with those settings.

3. **Scenario: Tag suggestions editable**  
   **Given** the system has auto-suggested tags from my draft  
   **When** I remove one suggestion and add a custom tag  
   **Then** the updated tag list persists with the article metadata.

### User Story 2 - Import Markdown/MDX (Priority: P1)

A blogger imports an existing article file (.md or .mdx, up to 8 MB), receives validation, and can publish or schedule it with all metadata filled.

**Why this priority**: Many writers author locally; import lowers friction and keeps flow consistent.

**Independent Test**: Upload a compliant MDX file under 8 MB, ensure content loads with embeds, large images warn appropriately, and publish successfully.

**Acceptance Scenarios**:

1. **Scenario: Successful MD import**  
   **Given** I upload a 5 MB `.md` file  
   **When** the system validates size and format  
   **Then** the article body populates the editor and I can save it as draft.

2. **Scenario: Oversized MDX asset warning**  
   **Given** I upload a `.mdx` file referencing a 12 MB image  
   **When** validation runs  
   **Then** I see a warning specifying which asset exceeds 8 MB and must adjust before saving.

3. **Scenario: Unsupported format rejection**  
   **Given** I upload a `.docx` file  
   **When** validation runs  
   **Then** the system rejects it with messaging that only `.md` and `.mdx` up to 8 MB are allowed.

### User Story 3 - Draft, Schedule, and Publish Control (Priority: P2)

A blogger saves private drafts online, schedules publication in JST with minute precision, edits scheduled content safely, and can toggle published articles back to private.

**Why this priority**: Guarantees control over visibility, timing, and fast top-page updates per persona goal.

**Independent Test**: Create a draft stored privately, schedule for a future JST time, edit before publish, receive prompts/notifications, and later unpublish the article.

**Acceptance Scenarios**:

1. **Scenario: Draft privacy enforcement**  
   **Given** I save a draft  
   **When** another account attempts to access it via direct URL  
   **Then** access is denied because drafts are author-only.

2. **Scenario: Scheduling prompt on edit**  
   **Given** I scheduled a post for 2025-11-15 08:30 JST  
   **When** I edit the content before the scheduled time  
   **Then** the system overwrites content, retains the schedule, and prompts me to reschedule with confirmation.

3. **Scenario: Publish failure notification**  
   **Given** a scheduled publish job fails  
   **When** the system detects the failure  
   **Then** I receive an email describing the failure and next steps to retry.

---

### Edge Cases

- Import attempts with files >8 MB should hard fail with actionable guidance.
- MDX referencing external media >8 MB must warn per asset; upload blocked until resolved.
- Scheduling cannot accept past JST times; UI must prevent or surface error.
- If user edits scheduled content close to publish time, ensure no duplicate publish occurs and prompts still fire.
- Network loss during in-browser editing must preserve local draft buffer until reconnect.
- Auto tag suggestions should handle extremely short articles (fallback to manual tags) and multilingual content.
- Category pagination must handle empty states gracefully (e.g., “No Tech posts yet”).
- Toggling a published article back to private should purge caches/top page listings within SLA (<1 minute).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow composing articles in-browser with headings, bold, italic, code blocks, image embeds, and video embeds.
- **FR-002**: System MUST allow importing `.md` and `.mdx` files up to 8 MB and validate referenced media sizes.
- **FR-003**: System MUST auto-suggest editable/removable tags derived from article content.
- **FR-004**: System MUST store drafts online in a private, encrypted location accessible only to the author.
- **FR-005**: System MUST support scheduling publication in JST with minute-level precision, disallowing past times.
- **FR-006**: System MUST notify via email if a scheduled publish job fails, including guidance to retry.
- **FR-007**: System MUST allow published articles to be toggled back to private and removed from public listings within 60 seconds.
- **FR-008**: Category header (Music, Movie, Tech, Blog) MUST provide paginated views per category without showing counts in the header.
- **FR-009**: Article appearance controls MUST persist font size and left padding settings per article.
- **FR-010**: System MUST prompt users to confirm/revise schedule whenever they edit content on a scheduled-but-unpublished article and must log that notification.
- **FR-011**: Category pagination MUST show 12 posts per page across Music/Movie/Tech/Blog lists.

*Unclear requirements to resolve during planning:*

- **FR-012**: File size warning copy specifics and UX details [NEEDS CLARIFICATION: message tone & link to docs].
- **FR-013**: Email notification template and sender identity [NEEDS CLARIFICATION].

### Key Entities

- **Article**: id, title, body (rich text/MDX), tags[], category, status (draft/scheduled/published/private), appearance settings (font_size, left_padding), scheduled_time (nullable), author_id, created_at, updated_at.
- **DraftStorage**: article_id, encrypted_blob_location, checksum, last_synced_at.
- **PublishJob**: job_id, article_id, scheduled_time, status (pending/running/success/failure), failure_reason, last_notification_at.
- **CategoryPage**: category_id, page_number, articles[], pagination_metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Top page first paint < 1 second on broadband (95th percentile).
- **SC-002**: 100% of drafts stored with encryption at rest and in transit (validated via audit logs).
- **SC-003**: ≥ 95% of scheduled posts publish successfully on time; failures trigger email within 1 minute.
- **SC-004**: Bloggers can import a compliant `.md/.mdx` file and see it rendered in ≤ 5 seconds 95% of the time.
- **SC-005**: User satisfaction survey (post-launch) shows ≥ 4/5 rating for “ease of publishing and scheduling.”

## Operational Readiness & Observability *(mandatory)*

- **OR-001**: Logging strategy must capture editor actions (compose/import/schedule), validation failures, and publish job status with author_id, article_id, timestamp.
- **OR-002**: Metrics: `frontend.first_paint_ms`, `import.duration_ms`, `publish.success_rate`, `publish.failure_count`, `draft.encryption_check_pass`.
- **OR-003**: Rollout: deploy behind feature flag per author cohort; rollback by disabling flag and reverting DB migrations; on-call owner documented in runbook.
- **OR-004**: Versioning: Feature introduction is a MINOR release in the blog platform; any future breaking changes to scheduling or import limits require MAJOR bump notes.
