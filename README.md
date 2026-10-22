# Photographer Prompt Hub (PhotoEditZoPromptGram)

A production-ready SaaS application for managing an Instagram page dedicated to photography inspiration, camera settings, and AI image-generation prompts, featuring **Gemini AI caption generation**, **Meta Instagram Graph API publishing**, and **automated comment-to-DM prompt delivery**.

---

## 1. Product Architecture & Key Features

- **Prompt Library**: Searchable catalog of photography generation prompts across 10 specialized categories (Wedding & Bridal, Fashion & Editorial, Cinematic Portraits, Creative Lighting, etc.) with camera sensors, focal lengths, lighting setups, and unique SEO slugs.
- **Post Composer**:
  - Ephemeral image upload with browser preview and automated TTL purging (zero binary image data in PostgreSQL).
  - Verbatim prompt preservation & inline association.
  - Gemini AI integration for structured title, caption, hashtags, and keyword suggestions.
  - Live Instagram mobile mockup and DM landing page preview.
- **Official Meta Instagram Integration**:
  - OAuth 2.0 connection flow with CSRF state protection.
  - Media container creation, asynchronous status polling, and official publishing API.
  - Authenticated AES-256-GCM token encryption at rest.
- **Comment-to-Prompt Automation**:
  - Meta Webhook receiver with HMAC-SHA256 signature verification (`x-hub-signature-256`).
  - Comment keyword matching (word boundaries, normalized tokens).
  - Official Meta Instagram Messenger Private Reply API (1 DM response within permitted 7-day window).
  - Strict idempotency (unique constraint on incoming comment ID prevents duplicate replies).
- **Publishing Calendar & Background Queue**:
  - Database-backed `ScheduledJob` queue.
  - Atomic claiming, concurrency protection, and exponential backoff retry handling.
  - Secured cron endpoint (`/api/cron/process-jobs`) for Vercel Cron.
- **Public Prompt Pages (`/p/[slug]`)**:
  - Fast, accessible, SEO-optimized public landing pages for Instagram followers.
  - One-click copy prompt button with clipboard tracking.
  - Zero permanent application storage dependency.

---

## 2. Technology Stack

- **Framework**: Next.js 16 (App Router) with React 19 & TypeScript Strict Mode
- **Styling**: Tailwind CSS with an editorial dark-room aesthetic tailored for photographers
- **Database & ORM**: Neon PostgreSQL with Prisma ORM and connection pooling
- **AI Engine**: Google Gemini API (`@google/genai` with `gemini-2.5-flash` model)
- **Security & Cryptography**: Node.js `crypto` (AES-256-GCM, HMAC-SHA256) & `jose` (JWT)
- **Background Execution**: Vercel Cron / External HTTP Scheduler

---

## 3. Database Schema (Prisma)

Models defined in `prisma/schema.prisma`:
- `User`: Administrator accounts with bcrypt password hashes.
- `InstagramAccount`: Linked Meta Instagram Professional Accounts with AES-256-GCM encrypted access tokens.
- `Prompt`: Titles, verbatim prompts, categories, tags, optical settings, and unique slugs.
- `Post`: Associated prompt, captions, hashtags, comment keywords, media IDs, permalinks, and statuses (`DRAFT`, `SCHEDULED`, `PUBLISHING`, `PUBLISHED`, `FAILED`).
- `ScheduledJob`: Durable background queue records with atomic claiming (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).
- `WebhookEvent`: Ingested Meta webhook event IDs and signatures for deduplication.
- `PromptRequest`: Incoming comment tracking, matched post/prompt, delivery status, and retry counts.
- `AutomationSetting`: Master automation switch, global keyword, reply templates, and asset retention hours.
- `ActivityLog`: Audit trail of publishing and messaging actions.

---

## 4. Environment Variables Setup

Copy `.env.example` to `.env` and configure your credentials:

```bash
# Neon PostgreSQL Connection
DATABASE_URL="postgresql://user:password@ep-project-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-project.us-east-2.aws.neon.tech/neondb?sslmode=require"

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

# Meta Instagram Graph API
META_APP_ID="your-meta-app-id"
META_APP_SECRET="your-meta-app-secret"
META_WEBHOOK_VERIFY_TOKEN="your-random-verification-token"

# Vercel Cron Queue Secret
CRON_SECRET="your-cron-secret"

# Ephemeral Storage Strategy
STORAGE_PROVIDER="ephemeral-serverless"
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

---

## 6. Local Development & Seeding

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Run database seed (populates 10 master photography prompts & default admin)
npm run seed  # or: npx tsx prisma/seed.ts

# Start development server
npm run dev
```

Visit `http://localhost:3000/login` and log in with:
- **Email**: `admin@photographerprompthub.com`
- **Password**: `PhotographerPromptAdmin2026!`

---

## 7. Deployment to Vercel with Neon

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. In the Vercel Project Settings, add all environment variables from `.env.example`.
4. Deploy! Vercel Cron will automatically invoke `/api/cron/process-jobs` on schedule defined in `vercel.json`.
