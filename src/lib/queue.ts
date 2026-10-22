import { prisma, checkDatabaseConnection } from "./prisma";
import { instagramService } from "./instagram";
import { storageService } from "./storage";
import type { JobType, JobStatus } from "@/types";

export interface ScheduledJobData {
  id: string;
  jobType: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string | null;
}

export const queueService = {
  /**
   * Schedule a new background job
   */
  scheduleJob: async (
    jobType: JobType,
    payload: Record<string, unknown>,
    runAt: Date,
    maxAttempts: number = 5
  ): Promise<ScheduledJobData> => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      throw new Error(`Database connection unavailable: ${dbCheck.message}. Job could not be scheduled.`);
    }

    const job = await prisma.scheduledJob.create({
      data: {
        jobType,
        payload: JSON.stringify(payload),
        runAt,
        maxAttempts,
        status: "PENDING",
      },
    });

    return {
      id: job.id,
      jobType: job.jobType as JobType,
      payload: JSON.parse(job.payload),
      status: job.status as JobStatus,
      runAt: job.runAt,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    };
  },

  /**
   * Process all due jobs with concurrency protection, atomic claiming, and exponential backoff
   */
  processDueJobs: async (workerId: string = "cron-worker"): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    details: Array<{ id: string; jobType: string; status: string; message?: string }>;
  }> => {
    const now = new Date();
    const details: Array<{ id: string; jobType: string; status: string; message?: string }> = [];
    let succeeded = 0;
    let failed = 0;

    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        details: [{ id: "none", jobType: "NONE", status: "FAILED", message: "Database is not connected" }],
      };
    }

    // 1. Recover stale locked jobs (locked for more than 10 minutes)
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    try {
      await prisma.scheduledJob.updateMany({
        where: {
          status: "PROCESSING",
          lockedAt: { lt: tenMinutesAgo },
        },
        data: {
          status: "PENDING",
          lockedAt: null,
          lockedBy: null,
        },
      });

      // Claim due jobs atomically
      const dueJobs = await prisma.scheduledJob.findMany({
        where: {
          status: "PENDING",
          runAt: { lte: now },
          attempts: { lt: 5 },
        },
        take: 10,
        orderBy: { runAt: "asc" },
      });

      for (const job of dueJobs) {
        // Optimistic locking / atomic claim
        const claimed = await prisma.scheduledJob.updateMany({
          where: {
            id: job.id,
            status: "PENDING",
          },
          data: {
            status: "PROCESSING",
            lockedAt: now,
            lockedBy: workerId,
            attempts: { increment: 1 },
          },
        });

        if (claimed.count === 0) continue; // Claimed by another concurrent worker

        const payload = JSON.parse(job.payload);
        let success = false;
        let jobError: string | null = null;

        try {
          if (job.jobType === "PUBLISH_POST") {
            const postId = payload.postId as string;
            const post = await prisma.post.findUnique({ where: { id: postId } });

            if (!post) {
              throw new Error(`Scheduled post ${postId} was not found in database.`);
            }

            if (post.status !== "SCHEDULED") {
              // Post was cancelled or already published
              success = true;
              jobError = `Post ${postId} is no longer in SCHEDULED state (current: ${post.status})`;
            } else {
              if (!post.temporaryImageUrl) {
                throw new Error(`Post ${postId} does not have an image URL to publish.`);
              }

              // Resolve connected Instagram account
              const account = await prisma.instagramAccount.findFirst({
                where: { isConnected: true },
                orderBy: { updatedAt: "desc" },
              });

              if (!account || !account.accessTokenEncrypted) {
                throw new Error("No connected Instagram Professional account found to publish scheduled post.");
              }

              await prisma.post.update({
                where: { id: postId },
                data: { status: "PUBLISHING" },
              });

              // Execute genuine Meta publish
              const fullCaption = `${post.caption}\n\n${post.hashtags}`.trim();
              const result = await instagramService.publishImagePost(
                account.accessTokenEncrypted,
                account.igUserId,
                post.temporaryImageUrl,
                fullCaption
              );

              if (result.success && result.mediaId) {
                await prisma.post.update({
                  where: { id: postId },
                  data: {
                    status: "PUBLISHED",
                    publishedAt: new Date(),
                    instagramMediaId: result.mediaId,
                    instagramPermalink: result.permalink || null,
                    errorMessage: null,
                  },
                });

                // Immediate cleanup of temporary image asset
                if (post.temporaryAssetKey) {
                  await storageService.deleteTemporaryAsset(post.temporaryAssetKey);
                }
                success = true;
              } else {
                jobError = result.error || "Meta publication returned no media ID";
                await prisma.post.update({
                  where: { id: postId },
                  data: {
                    status: "FAILED",
                    errorMessage: jobError,
                  },
                });
              }
            }
          } else if (job.jobType === "CLEANUP_TEMP_ASSETS") {
            const count = await storageService.cleanupExpiredAssets();
            success = true;
            jobError = `Cleaned ${count} expired temporary assets`;
          }

          if (success) {
            await prisma.scheduledJob.update({
              where: { id: job.id },
              data: {
                status: "COMPLETED",
                lockedAt: null,
              },
            });
            succeeded++;
            details.push({ id: job.id, jobType: job.jobType, status: "COMPLETED" });
          } else {
            throw new Error(jobError || "Job execution failed");
          }
        } catch (err: unknown) {
          failed++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          const nextAttempts = job.attempts + 1;
          const isPermanentFail = nextAttempts >= job.maxAttempts;

          // Exponential backoff: 2^attempts * 1 minute
          const backoffSeconds = Math.min(Math.pow(2, nextAttempts) * 60, 3600);
          const nextRunAt = new Date(Date.now() + backoffSeconds * 1000);

          await prisma.scheduledJob.update({
            where: { id: job.id },
            data: {
              status: isPermanentFail ? "FAILED" : "PENDING",
              runAt: nextRunAt,
              lockedAt: null,
              lastError: errorMsg,
            },
          });

          details.push({
            id: job.id,
            jobType: job.jobType,
            status: isPermanentFail ? "FAILED" : "RETRY_SCHEDULED",
            message: errorMsg,
          });
        }
      }

      return { processed: dueJobs.length, succeeded, failed, details };
    } catch (err: unknown) {
      console.error("Critical error in processDueJobs:", err);
      return { processed: 0, succeeded: 0, failed: 1, details: [{ id: "critical", jobType: "UNKNOWN", status: "FAILED", message: String(err) }] };
    }
  },
};
