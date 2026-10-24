# Photographer Prompt Hub (PhotoEditZoPromptGram)

A production-ready SaaS application for managing an Instagram page dedicated to photography inspiration, camera settings, and AI image-generation prompts, featuring **Google Gemini structured caption generation**, **temporary Vercel Blob image lifecycle management**, **official Meta Instagram Graph API publishing**, and **strict per-user/per-post DM idempotency**.

---

## 1. Product Architecture & Key Features

### A. Verbatim Prompt Preservation & Prompt Library
- Searchable catalog of photography prompts across 10 specialized categories (Wedding & Bridal, Fashion & Editorial, Cinematic Portraits, Creative Lighting, etc.) with optical settings (camera sensors, focal lengths, apertures, lighting setups) and unique SEO slugs.
- **Rule**: The original prompt text remains strictly unchanged and is never overwritten by AI generation or social media captioning.

### B. Vercel Blob Ephemeral Storage Lifecycle
- Temporary storage in **Vercel Blob** (`@vercel/blob`) with cryptographic namespace isolation (`temp-uploads/`).
- **Security & Validation**: Magic byte inspection verifies actual binary file contents (JPEG: `0xFF, 0xD8, 0xFF`, PNG: `0x89, 0x50, 0x4E, 0x47`, WEBP: `RIFF....WEBP`) to prevent disguised executables.
- **Strict Maximum Size Limit**: 10MB maximum file size enforced.
- **Ownership Verification**: Deletion is guarded by `isOwnedVercelBlobUrl` to strictly prevent deleting arbitrary user-supplied or external URLs.
- **Zero Permanent Image Storage**: No image binaries are stored in Neon PostgreSQL, and images are purged from Vercel Blob immediately following confirmed publication.

### C. Decoupled Publishing & Image Lifecycle States
- Post publishing status (`PostStatus`) and image lifecycle (`ImageLifecycleStatus`) are maintained as separate enums:
  - `PostStatus`: `DRAFT`, `SCHEDULED`, `PUBLISHING`, `PUBLISHED`, `FAILED`, `CANCELLED`
  - `ImageLifecycleStatus`: `UPLOADED`, `READY_TO_PUBLISH`, `PUBLISHING`, `PUBLISHED`, `CLEANUP_PENDING`, `DELETED`, `CLEANUP_FAILED`
- **Critical Invariant**: If temporary Blob cleanup fails (`CLEANUP_FAILED`), the post remains confirmed as `PUBLISHED` on Instagram. Cleanup failure never reverts the post or triggers republishing.

### D. Guaranteed Instagram DM Idempotency (Single Reply Policy)
- **Mandatory Business Rule**: For each unique Instagram user (`instagramScopedUserId`) and each published post (`postId`), the system initiates **at most one automated private reply**, regardless of how many times that user comments on the post.
- Enforced directly at the database level via a composite unique constraint in PostgreSQL:
  ```prisma
  @@unique([postId, instagramScopedUserId])
  ```
- Repeat comments and duplicate webhooks for the same user/post pair are atomically detected and suppressed (`SUPPRESSED`).
- The same user commenting on a *different* post qualifies independently.

### E. Durable Meta Webhooks & Job Queue
- Meta webhook receiver with HMAC-SHA256 signature verification (`x-hub-signature-256`) against the raw request body.
- Webhook comment deduplication via `@unique` constraint on incoming `commentId`.
- 7-day Meta messaging window validation.
- Background worker queue powered by `ScheduledJob` supporting atomic claiming, exponential backoff, and recovery from stale processing states.

---

## 2. Technology Stack

- **Framework**: Next.js 16 (App Router) with React 19 & TypeScript Strict Mode
- **Styling**: Tailwind CSS with an editorial dark-room aesthetic tailored for photographers
- **Database & ORM**: Neon Serverless PostgreSQL with Prisma ORM 6 and connection pooling
- **Temporary Storage**: Vercel Blob (`@vercel/blob`) with magic byte validation
- **AI Engine**: Google Gemini API (`@google/genai` with `gemini-3.5-flash-lite` and multi-tier fallbacks)
- **Security & Cryptography**: Node.js `crypto` (AES-256-GCM, HMAC-SHA256) & `jose` (JWT)
- **Test Framework**: Vitest with comprehensive unit and idempotency suites (23/23 passing)

> For full technical documentation, architecture deep dives, and live operational reports, see [DOCUMENTATION.md](file:///d:/VibingSites/automationtool/photoeditzopromptgram/DOCUMENTATION.md).

---

## 3. Database Schema Overview (Prisma)

Models defined in [`prisma/schema.prisma`](file:///d:/VibingSites/automationtool/photoeditzopromptgram/prisma/schema.prisma):
- `User`: Administrator accounts with bcrypt password hashes.
- `InstagramAccount`: Linked Meta Instagram Professional Accounts with AES-256-GCM encrypted access tokens.
- `Prompt`: Titles, original prompts, categories, tags, optical settings, and unique slugs.
- `Post`: Associated prompt, captions, hashtags, comment keywords, media IDs, permalinks, `status` enum, and decoupled `imageLifecycleStatus` enum with cleanup retry counters and reconciliation metadata.
- `ScheduledJob`: Durable background queue records with atomic claiming (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`). Supported job types: `PUBLISH_POST`, `RECONCILE_PUBLICATION`, `CLEANUP_BLOB`, `DELIVER_INSTAGRAM_DM`.
- `WebhookEvent`: Ingested Meta webhook event IDs and raw signatures with `@unique` constraint on `commentId` for deduplication.
- `PromptRequest`: Atomic delivery reservation with `@@unique([postId, instagramScopedUserId])`, delivery statuses (`RESERVED`, `SENDING`, `SENT`, `FAILED`, `UNKNOWN`, `SUPPRESSED`), and Meta message IDs.
- `AutomationSetting`: Master automation switch, global keyword, reply templates, and asset retention hours.
- `ActivityLog`: Audit trail of publishing, messaging, and storage actions.

---

## 4. Environment Variables Setup

Copy `.env.example` to `.env` and configure your credentials:

```bash
# Neon PostgreSQL Connection
DATABASE_URL="postgresql://user:password@ep-cool-project-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-cool-project.us-east-2.aws.neon.tech/neondb?sslmode=require"

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

# Storage Provider Strategy
STORAGE_PROVIDER="vercel-blob"
```

---

## 5. Meta Instagram Developer Setup Guide

1. **Create a Meta App**:
   - Go to [Meta for Developers](https://developers.facebook.com).
   - Create an app of type **Business**.
   - Add the **Instagram Graph API** and **Messenger API for Instagram** products.

2. **Configure Permissions (App Review)**:
   - `instagram_basic`: Read profile information and media IDs.
   - `instagram_content_publish`: Publish media to Instagram Business/Creator accounts.
   - `instagram_manage_comments`: Ingest comments via webhooks.
   - `instagram_manage_messages`: Send permitted private reply DMs.
   - `pages_show_list` & `pages_read_engagement`: Discover linked Instagram accounts.

3. **Configure Webhook Subscription**:
   - In Meta App Dashboard, navigate to **Webhooks** &gt; **Instagram**.
   - Set Callback URL: `https://your-domain.com/api/webhooks/instagram`
   - Set Verify Token: Value of `META_WEBHOOK_VERIFY_TOKEN`.
   - Subscribe to the `comments` field.

4. **Connect Instagram Professional Account**:
   - In the admin dashboard, navigate to **Settings** -> **Instagram Connection**.
   - Authenticate with Facebook OAuth. Tokens will be encrypted using AES-256-GCM before saving to Neon.

---

## 6. Local Development & Running Tests

### Installation & Database Setup
```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Seed initial prompts and admin
npm run seed

# 4. Run automated test suite
npm test
```

### Running the Development Server
```bash
npm run dev
```

Visit `http://localhost:3000/login` and log in with:
- **Email**: `admin@photographerprompthub.com`
- **Password**: `PhotographerPromptAdmin2026!`

---

## 7. Testing Suite Details

Automated tests are powered by **Vitest** in [`tests/`](file:///d:/VibingSites/automationtool/photoeditzopromptgram/tests):

### `tests/image-lifecycle.test.ts` (13 Tests)
- Magic byte validation for JPEG, PNG, and WEBP.
- Rejection of disguised executable files (`MZ` headers) and invalid file types.
- 10MB maximum file size limit enforcement.
- Vercel Blob store ownership validation (`isOwnedVercelBlobUrl`) and external URL deletion prevention.
- Verbatim prompt preservation during Gemini API failures.
- Cleanup eligibility enforcement (blocked if post is not confirmed `PUBLISHED`).
- Cleanup idempotency handling (absent/already-deleted Blob objects handled gracefully).
- Failure isolation: cleanup errors do not reset post status or republish.

### `tests/dm-idempotency.test.ts` (10 Tests)
- First qualifying comment creates one atomic reservation.
- Repeat comment from the same user on the same post is suppressed (`isDuplicate: true`, `status: "SUPPRESSED"`).
- Same user commenting on different posts qualifies independently.
- Different users commenting on the same post receive independent reservations.
- Concurrent webhook worker race condition safety (PostgreSQL unique constraint collision handling).
- Ambiguous delivery outcomes (network timeouts) classified as `UNKNOWN` to block blind resending.
- HMAC-SHA256 signature verification against raw payload.
- Meta 7-day private reply messaging policy window enforcement.

### Live Testing on a Connected Instagram Professional Account
1. Connect a real Instagram Creator/Professional account in `/settings`.
2. Upload an image in `/composer`, draft a caption with Gemini AI, and configure a test keyword (e.g., `LIGHT`).
3. Click **Publish Now**. Verify:
   - Media container is created (`/{ig-user-id}/media`).
   - Media container reaches `FINISHED` status.
   - Post publishes to Instagram profile (`/{ig-user-id}/media_publish`).
   - Confirmed Instagram Media ID and Permalink are persisted in Neon.
   - Vercel Blob temporary image is deleted post-publish.
4. Using a separate test Instagram account, comment the configured keyword on the published post.
5. Verify:
   - Webhook event is ingested and signature verified.
   - Exactly one private reply DM is delivered with the prompt link.
   - Commenting a second time from the same user on the same post is recorded in `/automation` as `SUPPRESSED (REPEAT COMMENT)`.

---

## 8. Manual Recovery Procedures

### A. Ambiguous Meta Publication Recovery
If a network timeout occurs while publishing to Meta:
1. The post status transitions to `RECONCILE_PUBLICATION` with `containerId` persisted.
2. The system queries Meta `/{container-id}?fields=status_code` to check if Meta finished processing.
3. If Meta completed publication, the post is confirmed and updated to `PUBLISHED` with the confirmed Media ID.
4. If Meta reports an error or the container expired, the post is safely marked `FAILED` for administrator review. Under no circumstances is a duplicate post blindly created.

### B. Temporary Blob Cleanup Retry
If temporary Vercel Blob deletion fails (e.g. storage outage or transient error):
1. The post status remains `PUBLISHED`.
2. The image lifecycle status is set to `CLEANUP_FAILED` with the attempt count incremented and last error recorded.
3. An authorized administrator can click **Retry Cleanup** in the **Dashboard** or **Calendar** (`/api/posts/[id]/cleanup-retry`).
4. The background cleanup job checks whether the Blob still exists (`head()`). If already deleted, cleanup is marked complete (`DELETED`).

### C. Ambiguous DM Outcome Recovery
If a timeout occurs during the Messenger API private reply request:
1. The reservation is marked `UNKNOWN` rather than `FAILED`.
2. The automation inbox displays the status with an amber/orange warning and blocks automated retries.
3. Administrators must verify in the Meta Professional Inbox whether the message was delivered before manually triggering a retry from the Automation Inbox.
