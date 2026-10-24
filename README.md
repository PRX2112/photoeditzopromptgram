# Photographer Prompt Hub (PhotoEditZoPromptGram)

A production-grade SaaS application designed for editorial curation and multi-channel Instagram publishing of photography prompts, featuring **Prompt-First content modeling**, **verbatim prompt preservation**, **collapsible optional technical metadata**, **collision-safe slug generation**, **ephemeral Vercel Blob storage lifecycle management**, **FFmpeg typography and vertical 4:5 image composition**, **Google Gemini social copy generation**, **official Meta Instagram Graph API publishing**, and **strict per-user/per-post DM idempotency**.

---

## 1. Product Architecture & Core Workflows

### A. Core Prompt Details & Verbatim Preservation
- **Primary Creative Asset**: The original photography prompt (`Prompt.originalPrompt`) is preserved **verbatim**. It is saved and retrieved exactly as entered and is never rewritten, summarized, or mutated by Gemini AI or social copy edits.
- **Required Fields**:
  1. **Title** (e.g. `The Candid Walk & Laugh — Hand-in-Hand`)
  2. **Source Image** (Uploaded securely to Vercel Blob with binary magic byte validation)
  3. **Original Photography Prompt** (Canonical natural language description)
  4. **Slug** (Automatically derived from the title; collision-safe and regenerable)
- **Collapsible Optional Technical Camera Metadata**:
  All technical camera and lighting parameters are strictly **optional**. Many valuable prompts are written in pure natural language without verified camera settings; prompts are saved successfully without fabricating metadata.
  - Optional fields: *Category, Tags, Camera Model, Lens, Focal Length, Aperture, Shutter Speed, ISO, Lighting Setup, Rendering Engine*.
  - AI suggestions are always presented as suggestions and are never treated as factual camera settings.

### B. Collision-Safe Slug Engine
- Located at [`src/lib/slugs.ts`](file:///d:/VibingSites/automationtool/photoeditzopromptgram/src/lib/slugs.ts).
- Normalizes titles by:
  - Decomposing Unicode diacritics and stripping accent marks.
  - Converting em-dashes (`—`) and en-dashes (`–`) to hyphens.
  - Converting ampersands (`&`) to spaces.
  - Stripping all non-alphanumeric characters (except spaces and hyphens).
  - Collapsing consecutive spaces and hyphens into single hyphens.
- Example: `"The Candid Walk & Laugh — Hand-in-Hand"` -> `"the-candid-walk-laugh-hand-in-hand"`.
- **Collision Safety**: If a public slug already exists, deterministic suffixes (`-2`, `-3`) are appended. Slugs are preserved across prompt edits unless explicitly regenerated.

### C. Temporary Vercel Blob Storage Lifecycle
- **Zero Permanent Image Binaries**: Temporary source and rendered images are stored in Vercel Blob (`@vercel/blob`) with cryptographic namespace isolation (`temp-uploads/`). No image binaries are stored in PostgreSQL.
- **Strict File Validation**: Binary magic byte verification ensures uploaded files are genuine JPEGs (`0xFF, 0xD8, 0xFF`), PNGs (`0x89, 0x50, 0x4E, 0x47`), or WEBPs (`RIFF....WEBP`). Disguised executables and files over 10MB are rejected.
- **Ownership Verification**: Deletion is strictly guarded by `isOwnedVercelBlobUrl` to prevent arbitrary or malicious deletion URLs.
- **Decoupled Lifecycle States**:
  - `PostStatus`: `DRAFT`, `SCHEDULED`, `PUBLISHING`, `PUBLISHED`, `FAILED`, `CANCELLED`
  - `ImageLifecycleStatus`: `UPLOADED`, `READY_TO_PUBLISH`, `PUBLISHING`, `PUBLISHED`, `CLEANUP_PENDING`, `DELETED`, `CLEANUP_FAILED`
- **Retention Rules**:
  - Source and rendered images remain available while a prompt is drafted, edited, scheduled, or recovering from a temporary Meta error.
  - Temporary Blob cleanup is enqueued **only after** confirmed Instagram publication details (Media ID, Permalink, published timestamp) are committed to the database.
  - If Blob cleanup fails, the post remains `PUBLISHED`. The failure is recorded (`CLEANUP_FAILED`), and an administrative retry action is made available. Cleanup failure never triggers republishing or duplicate DMs.

### D. Prompt Library & Availability Filtering
- Prompts display live status badges in the admin catalog:
  - `Available` — Unassigned to any active draft, scheduled, or published post.
  - `Draft in progress` — Attached to an editable draft.
  - `Scheduled` — Queued in the publishing calendar.
  - `Published` — Confirmed live on Instagram.
  - `Publication failed` — Requires administrative retry.
  - `Image cleanup pending` / `Image cleanup failed` — Decoupled storage states.
- The Instagram Composer selector lists only **unposted, unassigned prompts** by default (`?availableOnly=true`) to prevent accidental multi-posting of the same temporary image.

### E. Guided 4-Step Instagram Composer
The composer at `/composer` guides administrators through an editorial pipeline:
1. **Step 1 — Select Available Prompt**:
   - Lists available, unposted prompts with source image thumbnails.
   - Loads the canonical original prompt in a read-only, copyable area.
2. **Step 2 — Generate CTA-First Copy with Gemini AI**:
   - Generates conversion-optimized Instagram copy: 1. Short hook, 2. Prominent Comment-to-DM CTA (`👇 Comment {KEYWORD} to get the full photography prompt in your DMs!`), 3. Optional supporting line, 4. At most 5 hashtags.
   - Word count target of 40–70 words; eliminates long editorial paragraphs and unverified camera specs.
   - Live composer stats: character counter, word counter with target indicators, and keyword active/missing badges.
   - Manual user edit protection: Warns before overwriting custom caption edits.
   - Caption is kept strictly separate from the original prompt text.
3. **Step 3 — Render Final Image with FFmpeg**:
   - Renders a 1080 × 1350 (4:5 vertical portrait) image.
   - Preserves 100% of the photographer's image subject without stretching or distortion using a dark blurred background fill.
   - Embeds prompt title at the top header, an action-explaining dynamic CTA strip (`COMMENT "{KEYWORD}"`) near the bottom of the photo, and configured Instagram handle at the bottom footer.
   - Text is passed via UTF-8 temporary files to eliminate shell injection vulnerabilities.
   - Renders to temporary output, uploads to Vercel Blob, and displays an authentic preview.
4. **Step 4 — Review & Choose Action**:
   - **Save Draft**: Persists post and rendered asset; retains images for later editing.
   - **Schedule Post**: Requires valid future timestamp; respects timezone; keeps images available.
   - **Publish Now**: Creates Instagram media container, checks container status, publishes to profile, deduplicates caption and hashtags (max 5 tags), persists confirmed Media ID and permalink, and enqueues temporary image cleanup.

### F. Public Prompt Landing Pages (`/p/[slug]`)
- Shows prompt title, verbatim prompt with a 1-click copy button, and optional camera specs if present.
- **Instagram Embed**: When a post is published, attempts an official Instagram embed using the saved permalink.
- **Graceful Fallback**: If script blocking, private post settings, or network issues prevent embed rendering, a clean "View on Instagram" fallback link is displayed, and the original prompt remains 100% accessible.

### G. Instagram Comment-to-DM Automation & Idempotency
- **Single Private Reply Policy**: Enforced at the database level via composite unique constraint `@@unique([postId, instagramScopedUserId])`.
- Suppresses repeat comments from the same user on the same post.
- Webhook HMAC-SHA256 signature verification against raw payload.
- Meta 7-day messaging policy window validation.

---

## 2. Technology Stack

- **Framework**: Next.js 16 (App Router) with React 19 & TypeScript Strict Mode
- **Styling**: Tailwind CSS with an editorial dark-room aesthetic tailored for photographers
- **Database & ORM**: Neon Serverless PostgreSQL with Prisma ORM 6 and connection pooling
- **Temporary Storage**: Vercel Blob (`@vercel/blob`) with magic byte validation
- **Image Rendering**: FFmpeg with bundled TrueType font (`public/fonts/editorial-bold.ttf`) and `@ffmpeg-installer/ffmpeg`
- **AI Engine**: Google Gemini API (`@google/genai` with `gemini-3.5-flash-lite` and multi-tier fallbacks)
- **Social Media API**: Official Meta Instagram Graph API (Container -> Media Publish -> Webhooks -> Messenger Private Replies)
- **Security & Cryptography**: Node.js `crypto` (AES-256-GCM, HMAC-SHA256) & `jose` (JWT)
- **Test Framework**: Vitest (54/54 passing unit, workflow, CTA-first copy, and image CTA strip tests)

---

## 3. FFmpeg Configuration & Deployment Guide

### Local Development
FFmpeg is automatically discovered using a 3-tier resolution strategy:
1. `FFMPEG_PATH` environment variable (if explicitly defined).
2. `@ffmpeg-installer/ffmpeg` binary bundled in `node_modules`.
3. System-installed `ffmpeg` executable in PATH.

### Typography & Fonts
- Drawtext requires a TrueType font file.
- The project bundles [`public/fonts/editorial-bold.ttf`](file:///d:/VibingSites/automationtool/photoeditzopromptgram/public/fonts/editorial-bold.ttf) (1.03 MB), eliminating system font dependencies across Windows, macOS, and Linux.

### Vercel Production Deployment
On Vercel Serverless Functions:
- `@ffmpeg-installer/ffmpeg` is included in the project dependencies and resolved by `resolveFfmpegPath()`.
- Alternatively, you can configure the `@vercel/nft` include rule in `next.config.ts` or deploy with a container image containing `ffmpeg`.
- If FFmpeg fails to execute in production, the rendering route returns a clear `500` error with the exact deployment blocker message rather than silently substituting low-quality mock renders.

---

## 4. Environment Variables Setup

Copy `.env.example` to `.env` and configure your credentials:

```bash
# Neon PostgreSQL Connection
DATABASE_URL="postgresql://user:password@ep-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-direct.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Vercel Blob Temporary Storage Token
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxxxxx"

# Administrator Credentials
ADMIN_EMAIL="admin@photographerprompthub.com"
ADMIN_PASSWORD="PhotographerPromptAdmin2026!"
AUTH_SECRET="your-32-byte-hex-jwt-auth-secret"

# Cryptographic Keys (AES-256-GCM for Instagram tokens)
TOKEN_ENCRYPTION_KEY="your-32-byte-hex-encryption-key"

# App Public Domain
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"

# Google Gemini API
GEMINI_API_KEY="your-gemini-api-key"

# Meta Instagram Graph API & Webhooks
META_APP_ID="your-meta-app-id"
META_APP_SECRET="your-meta-app-secret"
META_WEBHOOK_VERIFY_TOKEN="your-random-verification-token"

# Scheduled Background Queue Secret
CRON_SECRET="your-cron-secret"

# Optional explicit FFmpeg executable path
# FFMPEG_PATH="/usr/bin/ffmpeg"
```

---

## 5. Database Schema & Migration Instructions

### Schema Overview
- **`Prompt`**: Verbatim `originalPrompt`, `title`, unique `slug`, `sourceImageUrl`, `sourceImageStatus`, optional camera fields (`cameraModel`, `lens`, `focalLength`, `aperture`, `shutterSpeed`, `iso`, `lightingSetup`, `renderingEngine`), and publication tracking (`isPublished`, `publishedAt`).
- **`Post`**: Associated prompt, captions, hashtags, comment keyword, `status` enum, rendered image details (`renderedImageUrl`, `renderedBlobPathname`, `renderedImageStatus`, `renderedAt`), Instagram IDs, and decoupled `imageLifecycleStatus`.
- **`PromptRequest`**: Atomic reservation with composite key `@@unique([postId, instagramScopedUserId])`.
- **`WebhookEvent`**: Webhook deduplication with `@unique` on `commentId`.
- **`ScheduledJob`**: Durable background queue records.

### Applying Schema Updates
```bash
# Apply schema changes to Neon PostgreSQL without resetting existing records
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

---

## 6. Running Tests & Quality Verification

Automated tests are powered by **Vitest**:

```bash
# Run the complete test suite
npm test

# Run TypeScript type check
npx tsc --noEmit
```

### Test Coverage (41 Tests)
1. **`tests/prompt-workflow.test.ts` (18 Tests)**:
   - Prompt creation with only required fields (title, image, original prompt).
   - Prompt creation with optional camera metadata omitted.
   - Verbatim prompt preservation.
   - Slug normalization (em-dashes, en-dashes, ampersands, diacritics).
   - Slug collision resolution (`-2`, `-3`).
   - Preserving existing slug during edits.
   - Gemini social copy generation and photographic fallback.
   - FFmpeg text wrapping, path escaping, and bundled font verification.
   - Draft creation without image deletion.
   - Scheduled post creation without image deletion.
   - Publication failure retaining required assets.
   - Confirmed publication triggering durable metadata persistence and cleanup enqueue.
   - Cleanup retry without republishing.
   - Guard against duplicate publishing while `PUBLISHING`.
2. **`tests/image-lifecycle.test.ts` (13 Tests)**:
   - Binary magic byte validation for JPEG, PNG, WEBP.
   - Rejection of disguised executable files and 10MB limits.
   - Vercel Blob store ownership validation (`isOwnedVercelBlobUrl`).
   - Cleanup eligibility enforcement (blocked if post is not confirmed `PUBLISHED`).
   - Cleanup idempotency (already-deleted Blob handled gracefully).
   - Isolation: cleanup failure marks `CLEANUP_FAILED` without resetting publication status.
3. **`tests/dm-idempotency.test.ts` (10 Tests)**:
   - First qualifying comment creates one atomic reservation.
   - Repeat comments from same user on same post are suppressed.
   - Independent qualification for different posts or different users.
   - Concurrent worker race collision safety.
   - Ambiguous delivery outcomes classified as `UNKNOWN` to block blind resending.
   - HMAC-SHA256 signature verification.
   - Meta 7-day messaging policy window enforcement.

---

## 7. Manual Operational Runbook

### Creating and Publishing a Post
1. Navigate to `/prompts` and click **New Prompt**.
2. Enter a Title (e.g. `Golden Hour Silhouette on the Dunes`) and paste your raw photography prompt verbatim.
3. Upload a source photo or provide a Blob URL. Leave the collapsible "Camera & Technical Metadata" section collapsed (or fill optional specs). Click **Save Prompt**.
4. In the prompt row, click **Use in Post** (or navigate to `/composer`).
5. **Step 1**: The available prompt is selected, showing its source thumbnail and verbatim prompt in a read-only area.
6. **Step 2**: Click **Generate Social Copy with Gemini**. Review and customize the generated caption, hashtags, and DM keyword.
7. **Step 3**: Click **Render 1080x1350 with FFmpeg**. Verify the 4:5 vertical preview with the title header and Instagram handle footer.
8. **Step 4**: Choose an action:
   - Click **Save Draft** to resume editing later.
   - Click **Schedule Post** with a future datetime.
   - Click **Publish Now** to post immediately to Instagram.
9. Upon publication success:
   - The post transitions to `PUBLISHED` with its confirmed Instagram Media ID and permalink.
   - The associated prompt is marked `isPublished = true` and removed from the available composer selector.
   - The temporary images are purged from Vercel Blob, transitioning lifecycle status to `DELETED`.

### Public Prompt Pages & Embed Verification
1. Visit `/p/[slug]` (e.g. `/p/golden-hour-silhouette-on-the-dunes`).
2. Verify the title and verbatim prompt are displayed with a 1-click **Copy Prompt** button.
3. If published, verify the official Instagram embed renders below the prompt. If scripts are blocked or the post is private, verify the clean fallback box with the "View on Instagram" button is displayed.
