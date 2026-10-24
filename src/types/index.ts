export type PostStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export type ImageLifecycleStatus =
  | "UPLOADED"
  | "READY_TO_PUBLISH"
  | "PUBLISHING"
  | "PUBLISHED"
  | "CLEANUP_PENDING"
  | "DELETED"
  | "CLEANUP_FAILED";

export type DMReservationStatus =
  | "RESERVED"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "UNKNOWN"
  | "SUPPRESSED";

export type DeliveryStatus = DMReservationStatus | "DELIVERED" | "IGNORED";

export type JobType =
  | "PUBLISH_POST"
  | "RECONCILE_PUBLICATION"
  | "CLEANUP_BLOB"
  | "CLEANUP_TEMP_ASSETS"
  | "DELIVER_INSTAGRAM_DM"
  | "RETRY_PRIVATE_REPLY";

export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface GenerationSettings {
  aspectRatio?: string;
  camera?: string;
  lens?: string;
  lighting?: string;
  engine?: string;
  iso?: string;
  aperture?: string;
  shutterSpeed?: string;
}

export interface PromptItem {
  id: string;
  title: string;
  originalPrompt: string;
  category: string;
  tags: string[];
  generationSettings?: GenerationSettings;
  slug: string;
  isArchived: boolean;
  viewCount: number;
  copyCount: number;

  // Source Image Storage Lifecycle
  sourceImageUrl?: string | null;
  sourceBlobPathname?: string | null;
  sourceContentType?: string | null;
  sourceImageSize?: number | null;
  sourceImageStatus?: ImageLifecycleStatus;
  sourceImageUploadedAt?: string | Date | null;
  sourceImageDeletedAt?: string | Date | null;

  // Publication & Availability State
  isPublished?: boolean;
  publishedAt?: string | Date | null;

  // Computed UI status
  status?:
    | "Available"
    | "Draft in progress"
    | "Scheduled"
    | "Published"
    | "Publication failed"
    | "Image cleanup pending"
    | "Image cleanup failed";

  // Optional Camera & Technical Metadata
  cameraModel?: string | null;
  lens?: string | null;
  focalLength?: string | null;
  aperture?: string | null;
  shutterSpeed?: string | null;
  iso?: string | null;
  lightingSetup?: string | null;
  renderingEngine?: string | null;

  latestPost?: PostItem | null;

  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PostItem {
  id: string;
  promptId: string;
  prompt?: PromptItem;
  instagramAccountId?: string | null;
  instagramAccount?: InstagramAccountItem | null;
  caption: string;
  hashtags: string;
  commentKeyword: string;
  mediaType: string;
  blobUrl?: string | null;
  blobPathname?: string | null;
  temporaryImageUrl?: string | null;
  temporaryAssetKey?: string | null;
  imageUploadedAt?: string | Date | null;
  imageLifecycleStatus?: ImageLifecycleStatus;
  imageDeletedAt?: string | Date | null;
  cleanupAttempts?: number;
  lastCleanupError?: string | null;

  // Finished Instagram Rendered Image (Created via FFmpeg)
  renderedImageUrl?: string | null;
  renderedBlobPathname?: string | null;
  renderedImageStatus?: ImageLifecycleStatus | null;
  renderedAt?: string | Date | null;
  sourceBlobDeletedAt?: string | Date | null;
  renderedBlobDeletedAt?: string | Date | null;

  containerId?: string | null;
  instagramMediaId?: string | null;
  instagramPermalink?: string | null;
  status: PostStatus;
  scheduledFor?: string | Date | null;
  publishedAt?: string | Date | null;
  publicationAttempts?: number;
  lastPublishError?: string | null;
  reconciliationMetadata?: string | null;
  errorMessage?: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstagramAccountItem {
  id: string;
  igUserId: string;
  username: string;
  name?: string | null;
  profilePictureUrl?: string | null;
  isConnected: boolean;
  permissions?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptRequestItem {
  id: string;
  postId?: string | null;
  matchedPostId?: string | null;
  matchedPost?: PostItem | null;
  instagramScopedUserId?: string | null;
  commenterId?: string | null;
  firstCommentId?: string | null;
  incomingCommentId?: string | null;
  instagramMediaId?: string | null;
  commentText?: string | null;
  matchedPromptId?: string | null;
  matchedPrompt?: PromptItem | null;
  deliveryStatus: DeliveryStatus;
  deliveryMethod?: string;
  metaMessageId?: string | null;
  privateReplyId?: string | null;
  attemptCount?: number;
  retryCount?: number;
  lastError?: string | null;
  errorMessage?: string | null;
  reservedAt?: string | null;
  sendingAt?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface AutomationSettingItem {
  id: string;
  instagramAccountId?: string | null;
  isAutomationEnabled: boolean;
  globalKeyword: string;
  replyTemplate: string;
  maxRepliesPerCommenter: number;
  retentionHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  userId?: string | null;
  createdAt: string;
}

export interface GeminiCaptionGenerationInput {
  originalPrompt: string;
  category?: string;
  imageTitle?: string;
  commentKeyword: string;
  captionStyle?: "editorial" | "storytelling" | "minimalist" | "technical";
}

export interface GeminiCaptionGenerationOutput {
  title: string;
  caption: string;
  hashtags: string[];
  commentKeyword?: string;
  suggestedKeywords: string[];
  altText: string;
  confidenceNotes?: string;
}

export interface InstagramMediaContainerResponse {
  id: string;
}

export interface InstagramMediaPublishResponse {
  id: string;
}

export interface InstagramMediaDetails {
  id: string;
  permalink?: string;
  timestamp?: string;
  media_type?: string;
  status_code?: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS";
}

export interface InstagramWebhookCommentChange {
  field: "comments";
  value: {
    id: string; // Comment ID
    text: string;
    from: {
      id: string; // Commenter IGSID
      username?: string;
    };
    media: {
      id: string; // Instagram Media ID
      media_product_type?: string;
    };
    created_time?: number;
    parent_id?: string;
  };
}

export interface InstagramWebhookPayload {
  object: "instagram";
  entry: Array<{
    id: string; // Instagram User ID
    time: number;
    changes: InstagramWebhookCommentChange[];
  }>;
}
