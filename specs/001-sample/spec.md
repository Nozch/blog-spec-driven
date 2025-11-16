# Feature Specification: Personal Blog Publishing Flow

**Feature Branch**: `001-sample`  
**Created**: 2025-11-07  
**Status**: Draft  
**Input**: User description: “Enable individual bloggers to publish and manage posts with fast category navigation, dual authoring modes, appearance controls, auto tag suggestions, and scheduling.”

**Constitution Link**: Per P1 Specification-First Source of Truth, this spec is the binding reference for downstream plans and tasks. Do not move to planning until every mandatory section below is complete and reviewed.

## Clarifications

### Session 2025-11-07
- Q: How many articles should each category page list per pagination step? → A: 12 posts per page

### Session 2025-11-12
- Q: What specific UX pattern and message copy should be used for file size warnings when uploads exceed 8 MB? → A: Inline toast notification with dismissible close button, displaying: "Upload blocked: `[filename]` is [size] MB. Files must be ≤8 MB. See [docs/blog/import-limits] for guidance." Toast stays visible for 10 seconds or until dismissed.
- Q: What email template and sender identity should be used for publish failure notifications? → A: Structured/actionable format with Subject: "Publish failed: [Article Title]" and Body: "Article: [title] | Scheduled: [JST time] | Failure: [reason]. Action: Visit [direct_link] to review and republish. If issue persists, contact support." Sender: publishing@blog.example.com

### Session 2025-11-14
- Q: Which approach should be used to generate tag auto-suggestions from article content? → A: Hybrid backend - OpenSearch keyword extraction + lightweight model for semantic tag ranking
- Q: What is the maximum acceptable latency for tag auto-suggestion generation after an article is submitted for analysis? → A: 3 seconds
- Q: When should the tag auto-suggestion process be triggered during article authoring? → A: Manual trigger - User clicks "Suggest Tags" button
- Q: How many tag suggestions should the system generate and present to the user when they click "Suggest Tags"? → A: 5 tags maximum
- Q: What should the UI display if tag suggestion fails (timeout, service error, or network issue)? → A: Error toast + manual fallback - Show "Tag suggestions unavailable. Add tags manually." with dismissible toast, keep tag input field enabled
- Q: Which article content fields should be used as input for tag extraction? → A: Use both the article title and the body content as the input fields for tag extraction. The tag-suggestion feature should treat title + body as the combined source text when generating candidate tags.
- Q: What minimum content length (title + body combined) should trigger tag suggestion generation vs. showing a "content too short" message? → A: 100 characters minimum
- Q: What criteria define a "quality candidate" tag that should be included in the results vs. filtered out? → A: Minimum hybrid score threshold (combined semantic+frequency score ≥0.3 on 0-1 scale)
- Q: How should the 3-second total latency budget be allocated across components? → A: OpenSearch extraction 1s, Model2Vec inference 1.5s, Network overhead 0.5s
- Q: What is the service orchestration flow for tag suggestion generation? → A: Next.js API route receives request → invokes AWS Lambda → Lambda queries OpenSearch for keyword extraction → Lambda applies Model2Vec semantic ranking → Lambda returns ranked tags to API → API returns to client
- Q: How should the tag suggestion system handle multilingual content? → A: Language-agnostic semantic embeddings with Japanese-focused multilingual Model2Vec model (no language detection needed, works seamlessly with Japanese, English, and mixed-language content)

## Outstanding Ambiguities
- **Draft Access Beyond Author**: Draft privacy (FR-004) assumes single-author access but does not state whether admins/support can view drafts or how escalations work.
- **Scheduling Precision Edge Cases**: Minute-level JST scheduling lacks guidance for edge cases (e.g., DST—not observed—and sub-minute submissions); call out whether these are in or out of scope.
- **Category Pagination Zero/Overflow States**: FR-011 should capture empty-category UX and >N-page scenarios currently relegated to Edge Cases for better traceability.
- **Performance Metric Measurement**: SC-001 and SC-004 specify targets but not measurement method (tools, sampling window); add methodology to avoid disputes.
- **Operational Runbook Fields**: OR-003 references a runbook/on-call owner but omits required fields or doc location; clarify expectations for rollout readiness.
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
   **Given** I have drafted article content
   **When** I click the "Suggest Tags" button, review the generated suggestions, remove one, and add a custom tag
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
- Auto tag suggestions (OpenSearch + Japanese-focused multilingual Model2Vec hybrid) should handle content length validation (show "Content too short for tag suggestions. Add more content or add tags manually." if combined title + body <100 characters), limited candidate scenarios (return fewer than 5 tags if fewer than 5 candidates meet the ≥0.3 hybrid score threshold; return 0 tags with "No quality tag suggestions found. Add tags manually." if no candidates meet the threshold), and multilingual content (Japanese, English, mixed-language processed seamlessly without language detection via language-agnostic embeddings).
- If tag suggestion service fails (timeout >3s, service error, network issue), display dismissible error toast: "Tag suggestions unavailable. Add tags manually." Tag input field remains enabled so user can proceed with manual tags.
- Category pagination must handle empty states gracefully (e.g., “No Tech posts yet”).
- Toggling a published article back to private should purge caches/top page listings within SLA (<1 minute).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow composing articles in-browser with headings, bold, italic, code blocks, image embeds, and video embeds.
- **FR-002**: System MUST allow importing `.md` and `.mdx` files up to 8 MB and validate referenced media sizes.
- **FR-003**: System MUST provide a "Suggest Tags" button that, when clicked, generates up to 5 editable/removable tag suggestions derived from the combined article title and body content using a hybrid backend approach: OpenSearch keyword extraction combined with a Japanese-focused multilingual Model2Vec model for semantic tag ranking. The title and body are concatenated as the source text for tag candidate generation. If the combined content length is less than 100 characters, the system MUST display the message "Content too short for tag suggestions. Add more content or add tags manually." Service orchestration: Next.js API route invokes AWS Lambda, which queries OpenSearch for keyword extraction, applies Model2Vec semantic ranking with hybrid scoring (70% semantic + 30% frequency), and returns ranked results. The system handles multilingual content (Japanese, English, mixed-language) seamlessly without language detection. Only tags with a combined hybrid score of ≥0.3 on a 0-1 scale qualify as quality candidates and are included in results. Tags must be presented in relevance-ranked order (highest score first) and be editable and removable by the author after generation.
- **FR-004**: System MUST store drafts online in a private, encrypted location accessible only to the author.
- **FR-005**: System MUST support scheduling publication in JST with minute-level precision, disallowing past times.
- **FR-006**: System MUST notify via email if a scheduled publish job fails, including guidance to retry.
- **FR-007**: System MUST allow published articles to be toggled back to private and removed from public listings within 60 seconds.
- **FR-008**: Category header (Music, Movie, Tech, Blog) MUST provide paginated views per category without showing counts in the header.
- **FR-009**: Article appearance controls MUST persist font size and left padding settings per article.
- **FR-010**: System MUST prompt users to confirm/revise schedule whenever they edit content on a scheduled-but-unpublished article and must log that notification.
- **FR-011**: Category pagination MUST show 12 posts per page across Music/Movie/Tech/Blog lists.
- **FR-012**: System MUST display an inline toast notification when file size exceeds 8 MB, showing: "Upload blocked: `[filename]` is [actual_size] MB. Files must be ≤8 MB. See docs/blog/import-limits for guidance." Toast remains visible for 10 seconds or until user dismisses it.
- **FR-013**: System MUST send email notification for publish failures with Subject: "Publish failed: [Article Title]" and Body: "Article: [title] | Scheduled: [JST time] | Failure: [reason]. Action: Visit [direct_link] to review and republish. If issue persists, contact support." Sender identity: publishing@blog.example.com
- **FR-014**: System MUST display a dismissible error toast stating "Tag suggestions unavailable. Add tags manually." when tag suggestion fails due to timeout (>3s), service error, or network issue. The tag input field MUST remain enabled to allow manual tag entry without blocking the authoring workflow.

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
- **SC-005**: Tag auto-suggestions must be generated and displayed to the user within 3 seconds of article submission for analysis (95th percentile). Component targets: OpenSearch keyword extraction ≤1s, Model2Vec semantic ranking ≤1.5s, network overhead ≤0.5s.
- **SC-006**: User satisfaction survey (post-launch) shows ≥ 4/5 rating for "ease of publishing and scheduling."

## Operational Readiness & Observability *(mandatory)*

- **OR-001**: Logging strategy must capture editor actions (compose/import/schedule), validation failures, publish job status, and tag suggestion requests (success/failure/timeout) with author_id, article_id, timestamp, and failure_reason when applicable.
- **OR-002**: Metrics: `frontend.first_paint_ms`, `import.duration_ms`, `publish.success_rate`, `publish.failure_count`, `draft.encryption_check_pass`, `tag_suggestion.latency_ms`, `tag_suggestion.success_rate`, `tag_suggestion.opensearch_latency_ms`, `tag_suggestion.model2vec_latency_ms`, `tag_suggestion.network_latency_ms`.
- **OR-003**: Rollout: deploy behind feature flag per author cohort; rollback by disabling flag and reverting DB migrations; on-call owner documented in runbook.
- **OR-004**: Versioning: Feature introduction is a MINOR release in the blog platform; any future breaking changes to scheduling or import limits require MAJOR bump notes.
