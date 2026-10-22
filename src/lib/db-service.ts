import { prisma, checkDatabaseConnection } from "./prisma";
import type {
  PromptItem,
  PostItem,
  PromptRequestItem,
  AutomationSettingItem,
  ActivityLogItem,
  InstagramAccountItem,
} from "@/types";

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

// Seeded catalog template prompts (read-only reference prompts)
const INITIAL_PROMPTS: PromptItem[] = [
  {
    id: "p-1",
    title: "Golden Hour Tuscan Vineyard Bridal Portrait",
    originalPrompt:
      "High-end editorial bridal portrait in a rolling Tuscan vineyard at golden hour, bride wearing an intricate ivory lace backless gown by Elie Saab, gentle warm backlight glowing through veil, soft breeze catching silk tulle, Canon EOS R5, RF 85mm f/1.2L USM, f/1.4, 1/800s, ISO 100, Kodak Portra 400 film tones, ultra-realistic skin texture, romantic cinematic depth of field, hyper-detailed drapery.",
    category: "Wedding and bridal",
    tags: ["bridal", "tuscan", "golden-hour", "lace-gown", "canon-85mm", "cinematic"],
    generationSettings: {
      aspectRatio: "4:5",
      camera: "Canon EOS R5",
      lens: "85mm f/1.2",
      lighting: "Warm rim backlight, soft diffused golden hour",
      engine: "Midjourney v6.1 / Flux.1 Schnell",
    },
    slug: "golden-hour-tuscan-vineyard-bridal-portrait",
    isArchived: false,
    viewCount: 0,
    copyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-2",
    title: "Moody Rainy Streets Paris Pre-Wedding",
    originalPrompt:
      "Cinematic 35mm street photography couple portrait under a vintage black umbrella in the rain near Pont Alexandre III in Paris, glistening cobblestones reflecting warm amber street lanterns and distant Eiffel Tower glow, stylish tailored trench coats, romantic eye contact, mist, shallow depth of field, Leica M11, Noctilux-M 50mm f/0.95 ASPH, cinematic color grading, film grain, emotional atmosphere.",
    category: "Couple and pre-wedding",
    tags: ["couple", "paris", "rain", "umbrella", "leica", "moody", "cinematic"],
    generationSettings: {
      aspectRatio: "4:5",
      camera: "Leica M11",
      lens: "50mm f/0.95",
      lighting: "Wet asphalt reflections, warm streetlamps, ambient mist",
      engine: "Midjourney v6.1",
    },
    slug: "moody-rainy-streets-paris-pre-wedding",
    isArchived: false,
    viewCount: 0,
    copyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-3",
    title: "Avant-Garde Architectural Haute Couture Editorial",
    originalPrompt:
      "High fashion editorial in an open concrete Brutalist pavilion, haute couture structured metallic organza silhouette dress in iridescent champagne and charcoal, striking dynamic pose, sharp architectural shadows from midday sun, Hasselblad H6D-100c, HC 100mm f/2.2, crisp studio-grade clarity, Vogue Italia aesthetic, polished clean styling.",
    category: "Fashion and editorial",
    tags: ["fashion", "haute-couture", "brutalist", "hasselblad", "vogue", "editorial"],
    generationSettings: {
      aspectRatio: "4:5",
      camera: "Hasselblad H6D-100c",
      lens: "HC 100mm f/2.2",
      lighting: "Hard directional daylight with sculpted brutalist geometry",
      engine: "Flux.1 Dev",
    },
    slug: "avant-garde-architectural-haute-couture-editorial",
    isArchived: false,
    viewCount: 0,
    copyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-4",
    title: "Fine Art Botanical Studio Maternity",
    originalPrompt:
      "Fine art maternity portrait in a minimalist studio, expectant mother wrapped in delicate translucent ochre silk chiffon floating gracefully around silhouette, surrounded by lush monstera and eucalyptus botanicals, soft Rembrandt light from large north-facing window, Sony A7R V, FE 50mm f/1.2 GM, serene and empowering expression, velvet dark background, muted earth tones.",
    category: "Maternity",
    tags: ["maternity", "fine-art", "chiffon", "botanical", "rembrandt-light", "sony"],
    generationSettings: {
      aspectRatio: "4:5",
      camera: "Sony A7R V",
      lens: "50mm f/1.2 GM",
      lighting: "Large north-facing diffused softbox / window",
      engine: "Midjourney v6.1",
    },
    slug: "fine-art-botanical-studio-maternity",
    isArchived: false,
    viewCount: 0,
    copyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-5",
    title: "Organic Wool Knit Sleeping Newborn",
    originalPrompt:
      "Peaceful macro portrait of a newborn infant sleeping swaddled in chunky hand-knit cream merino wool, resting on an unbleached linen bed, delicate baby eyelashes in sharp focus, warm natural side light from a low window, gentle feather-light shadows, Nikon Z9, Nikkor Z MC 105mm f/2.8 VR S, macro detail, soft pastel palette, pristine organic warmth.",
    category: "Newborn and baby",
    tags: ["newborn", "macro", "merino-wool", "natural-light", "nikon", "serene"],
    generationSettings: {
      aspectRatio: "1:1",
      camera: "Nikon Z9",
      lens: "105mm f/2.8 VR Micro",
      lighting: "Soft indirect morning window light",
      engine: "Flux.1 Dev",
    },
    slug: "organic-wool-knit-sleeping-newborn",
    isArchived: false,
    viewCount: 0,
    copyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-6",
    title: "Autumn Coastal Cliffside Family Lifestyle",
    originalPrompt:
      "Candid authentic family of four walking along a rugged Pacific Northwest coastal cliff at dusk, parents holding hands with two young children laughing, cozy cable-knit sweaters and earthy beanies, dramatic stormy waves crashing below, misty atmospheric sea spray, Fujifilm GFX 100 II, GF 45-100mm f/4 R LM OIS WR, raw emotional documentary feeling, rich PNW emerald and driftwood tones.",
    category: "Family portraits",
    tags: ["family", "coastal", "pacific-northwest", "fujifilm-gfx", "documentary", "candid"],
    generationSettings: {
      aspectRatio: "4:5",
      camera: "Fujifilm GFX 100 II",
      lens: "GF 45-100mm f/4",
      lighting: "Overcast twilight blue hour with ambient surf reflection",
      engine: "Midjourney v6.1",
    },
    slug: "autumn-coastal-cliffside-family-lifestyle",
    isArchived: false,
    viewCount: 0,
    copyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-7",
    title: "Neon Cyberpunk Noir Cinematic Portrait",
    originalPrompt:
      "Cinematic moody low-key portrait of a contemplative subject by a rain-slicked Tokyo alley window, split lighting with cyan neon signs reflecting on wet cheekbones and warm amber incandescent rim light, shallow focus on raindrop condensation on window glass, Arri Alexa Mini LF, Cooke Anamorphic /i 40mm T2.3, authentic horizontal anamorphic blue streak flares, rich cinema shadows.",
    category: "Cinematic portraits",
    tags: ["cinematic", "cyberpunk", "neon", "rain", "anamorphic", "arri", "tokyo"],
    generationSettings: {
      aspectRatio: "16:9",
      camera: "Arri Alexa Mini LF",
      lens: "Cooke Anamorphic /i 40mm",
      lighting: "Dual-tone neon cyan & warm tungsten split",
      engine: "Midjourney v6.1",
    },
    slug: "neon-cyberpunk-noir-cinematic-portrait",
    isArchived: false,
    viewCount: 0,
    copyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-8",
    title: "Luxury Horology Floating In Water Droplets",
    originalPrompt:
      "Commercial macro product photograph of a luxury skeleton automatic chronograph watch suspended above ripples of black liquid water, crisp micro water splashes frozen in mid-air, dial reflections highlighting rose gold bevels and sapphire crystal, Broncolor studio flash setup with honeycomb snoot, Phase One IQ4 150MP, 120mm Macro f/4, f/16, ultra-sharp precision, high-end Swiss advertising standard.",
    category: "Product photography",
    tags: ["product", "luxury-watch", "macro", "splash", "broncolor", "phase-one"],
    generationSettings: {
      aspectRatio: "1:1",
      camera: "Phase One IQ4 150MP",
      lens: "Schneider Kreuznach 120mm Macro",
      lighting: "High-speed sync strobe with parabolic reflector and strip gridded boxes",
      engine: "Flux.1 Pro",
    },
    slug: "luxury-horology-floating-in-water-droplets",
    isArchived: false,
    viewCount: 0,
    copyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-9",
    title: "Chiaroscuro Prismatic Glass Creative Lighting",
    originalPrompt:
      "Creative editorial studio portrait experimenting with optical refraction, face partially obscured by faceted crystal prisms casting rainbow caustics across eyes and cheek, dramatic Chiaroscuro hard key light through patterned Venetian blinds, deep obsidian shadows, Canon EOS 5D Mark IV, EF 85mm f/1.4L IS USM, experimental art gallery aesthetic, striking visual rhythm.",
    category: "Creative lighting",
    tags: ["creative-lighting", "prisms", "refraction", "chiaroscuro", "caustics", "studio"],
    generationSettings: {
      aspectRatio: "4:5",
      camera: "Canon EOS 5D Mark IV",
      lens: "85mm f/1.4L",
      lighting: "Hard optical spot through crystal prisms + venetian blind gobo",
      engine: "Midjourney v6.1",
    },
    slug: "chiaroscuro-prismatic-glass-creative-lighting",
    isArchived: false,
    viewCount: 0,
    copyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-10",
    title: "Monochrome Sculptural Ballet Studio Portrait",
    originalPrompt:
      "Sculptural black and white studio portrait of a classical male ballet dancer in mid-leap tension, muscular anatomy highlighted with sharp rim lighting against pitch black backdrop, subtle chalk dust freezing in air, high contrast monochrome with deep blacks and luminous highlights, Hasselblad 907X 50C, XCD 90mm f/3.2, timeless physical poetry, tribute to Herb Ritts.",
    category: "Studio photography",
    tags: ["studio", "black-and-white", "dance", "ballet", "herb-ritts", "monochrome"],
    generationSettings: {
      aspectRatio: "4:5",
      camera: "Hasselblad 907X",
      lens: "XCD 90mm f/3.2",
      lighting: "Dual high-powered rim strobes with edge kickers",
      engine: "Midjourney v6.1",
    },
    slug: "monochrome-sculptural-ballet-studio-portrait",
    isArchived: false,
    viewCount: 0,
    copyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const dbService = {
  // Check database health
  checkHealth: async () => {
    return checkDatabaseConnection();
  },

  // INSTAGRAM ACCOUNT OPERATIONS
  getConnectedInstagramAccount: async (): Promise<InstagramAccountItem | null> => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      return null;
    }

    try {
      const account = await prisma.instagramAccount.findFirst({
        where: { isConnected: true },
        orderBy: { updatedAt: "desc" },
      });

      if (!account) return null;

      return {
        id: account.id,
        igUserId: account.igUserId,
        username: account.username,
        name: account.name,
        profilePictureUrl: account.profilePictureUrl,
        accessTokenEncrypted: account.accessTokenEncrypted,
        tokenExpiresAt: account.tokenExpiresAt ? account.tokenExpiresAt.toISOString() : null,
        isConnected: account.isConnected,
        permissions: account.permissions,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      };
    } catch (err: unknown) {
      console.error("Database query failed in getConnectedInstagramAccount:", err);
      return null;
    }
  },

  saveInstagramAccount: async (data: {
    igUserId: string;
    username: string;
    name?: string | null;
    profilePictureUrl?: string | null;
    accessTokenEncrypted: string;
    tokenExpiresAt?: Date | null;
    permissions?: string;
    userId?: string;
  }): Promise<InstagramAccountItem> => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      throw new DatabaseError(`Database connection failed: ${dbCheck.message}. Cannot save Instagram account.`);
    }

    let targetUserId = data.userId;
    if (!targetUserId) {
      const admin = await prisma.user.findFirst();
      if (admin) {
        targetUserId = admin.id;
      } else {
        const createdAdmin = await prisma.user.create({
          data: {
            email: process.env.ADMIN_EMAIL || "admin@photographerprompthub.com",
            name: "Photography Director",
            passwordHash: "pending",
            role: "ADMIN",
          },
        });
        targetUserId = createdAdmin.id;
      }
    }

    const account = await prisma.instagramAccount.upsert({
      where: { igUserId: data.igUserId },
      update: {
        username: data.username,
        name: data.name,
        profilePictureUrl: data.profilePictureUrl,
        accessTokenEncrypted: data.accessTokenEncrypted,
        tokenExpiresAt: data.tokenExpiresAt,
        isConnected: true,
        permissions: data.permissions,
      },
      create: {
        userId: targetUserId,
        igUserId: data.igUserId,
        username: data.username,
        name: data.name,
        profilePictureUrl: data.profilePictureUrl,
        accessTokenEncrypted: data.accessTokenEncrypted,
        tokenExpiresAt: data.tokenExpiresAt,
        isConnected: true,
        permissions: data.permissions,
      },
    });

    return {
      id: account.id,
      igUserId: account.igUserId,
      username: account.username,
      name: account.name,
      profilePictureUrl: account.profilePictureUrl,
      accessTokenEncrypted: account.accessTokenEncrypted,
      tokenExpiresAt: account.tokenExpiresAt ? account.tokenExpiresAt.toISOString() : null,
      isConnected: account.isConnected,
      permissions: account.permissions,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  },

  disconnectInstagramAccount: async (igUserId?: string): Promise<{ success: boolean; count: number }> => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      throw new DatabaseError(`Database connection failed: ${dbCheck.message}. Cannot disconnect account.`);
    }

    const whereClause = igUserId ? { igUserId } : { isConnected: true };
    const updated = await prisma.instagramAccount.updateMany({
      where: whereClause,
      data: { isConnected: false },
    });

    return { success: true, count: updated.count };
  },

  // PROMPTS
  getPrompts: async (options?: { category?: string; search?: string; includeArchived?: boolean }) => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const where: Record<string, unknown> = {};
        if (!options?.includeArchived) {
          where.isArchived = false;
        }
        if (options?.category && options.category !== "all") {
          where.category = options.category;
        }
        if (options?.search) {
          where.OR = [
            { title: { contains: options.search, mode: "insensitive" } },
            { originalPrompt: { contains: options.search, mode: "insensitive" } },
            { tags: { contains: options.search, mode: "insensitive" } },
          ];
        }

        const items = await prisma.prompt.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        if (items.length > 0) {
          return items.map((p) => ({
            ...p,
            tags: p.tags ? p.tags.split(",").map((t) => t.trim()) : [],
            generationSettings: p.generationSettings ? JSON.parse(p.generationSettings) : undefined,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          }));
        }
      }
    } catch (err: unknown) {
      console.warn("Database prompt lookup error, displaying reference catalog:", err);
    }

    // Reference catalog templates
    let list = [...INITIAL_PROMPTS];
    if (!options?.includeArchived) {
      list = list.filter((p) => !p.isArchived);
    }
    if (options?.category && options.category !== "all") {
      list = list.filter((p) => p.category.toLowerCase() === options.category?.toLowerCase());
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.originalPrompt.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  },

  getPromptById: async (id: string) => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const p = await prisma.prompt.findUnique({ where: { id } });
        if (p) {
          return {
            ...p,
            tags: p.tags ? p.tags.split(",").map((t) => t.trim()) : [],
            generationSettings: p.generationSettings ? JSON.parse(p.generationSettings) : undefined,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          };
        }
      }
    } catch (err: unknown) {
      console.error("Database prompt lookup error:", err);
    }

    return INITIAL_PROMPTS.find((p) => p.id === id) || null;
  },

  getPromptBySlug: async (slug: string) => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const p = await prisma.prompt.findUnique({
          where: { slug },
          include: {
            posts: {
              where: { status: "PUBLISHED" },
              select: { instagramPermalink: true, publishedAt: true },
              take: 1,
            },
          },
        });
        if (p) {
          return {
            ...p,
            tags: p.tags ? p.tags.split(",").map((t) => t.trim()) : [],
            generationSettings: p.generationSettings ? JSON.parse(p.generationSettings) : undefined,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            latestPost: p.posts[0] || null,
          };
        }
      }
    } catch (err: unknown) {
      console.error("Database slug lookup error:", err);
    }

    const item = INITIAL_PROMPTS.find((p) => p.slug === slug);
    if (!item) return null;

    return {
      ...item,
      latestPost: null,
    };
  },

  createPrompt: async (data: {
    title: string;
    originalPrompt: string;
    category: string;
    tags: string[];
    generationSettings?: Record<string, unknown>;
    slug: string;
  }) => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      throw new DatabaseError(`Database connection unavailable: ${dbCheck.message}. Prompt write could not be confirmed.`);
    }

    const p = await prisma.prompt.create({
      data: {
        title: data.title,
        originalPrompt: data.originalPrompt,
        category: data.category,
        tags: data.tags.join(","),
        generationSettings: data.generationSettings ? JSON.stringify(data.generationSettings) : null,
        slug: data.slug,
      },
    });

    return {
      ...p,
      tags: p.tags.split(",").map((t) => t.trim()),
      generationSettings: p.generationSettings ? JSON.parse(p.generationSettings) : undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  },

  updatePrompt: async (
    id: string,
    data: Partial<{
      title: string;
      originalPrompt: string;
      category: string;
      tags: string[];
      generationSettings?: Record<string, unknown>;
      slug: string;
      isArchived: boolean;
    }>
  ) => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      throw new DatabaseError(`Database connection unavailable: ${dbCheck.message}. Prompt update could not be confirmed.`);
    }

    const p = await prisma.prompt.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.originalPrompt && { originalPrompt: data.originalPrompt }),
        ...(data.category && { category: data.category }),
        ...(data.tags && { tags: data.tags.join(",") }),
        ...(data.generationSettings && { generationSettings: JSON.stringify(data.generationSettings) }),
        ...(data.slug && { slug: data.slug }),
        ...(data.isArchived !== undefined && { isArchived: data.isArchived }),
      },
    });

    return {
      ...p,
      tags: p.tags.split(",").map((t) => t.trim()),
      generationSettings: p.generationSettings ? JSON.parse(p.generationSettings) : undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  },

  incrementPromptCopies: async (slug: string) => {
    const dbCheck = await checkDatabaseConnection();
    if (dbCheck.ok) {
      try {
        await prisma.prompt.update({
          where: { slug },
          data: { copyCount: { increment: 1 } },
        });
      } catch {
        // Safe tracking failure
      }
    }
  },

  incrementPromptViews: async (slug: string) => {
    const dbCheck = await checkDatabaseConnection();
    if (dbCheck.ok) {
      try {
        await prisma.prompt.update({
          where: { slug },
          data: { viewCount: { increment: 1 } },
        });
      } catch {
        // Safe tracking failure
      }
    }
  },

  // POSTS
  getPosts: async (options?: { status?: string }) => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      return [];
    }

    try {
      const where: Record<string, unknown> = {};
      if (options?.status && options.status !== "ALL") {
        where.status = options.status;
      }
      const items = await prisma.post.findMany({
        where,
        include: { prompt: true, instagramAccount: true },
        orderBy: { createdAt: "desc" },
      });

      return items.map((post) => ({
        ...post,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        scheduledFor: post.scheduledFor ? post.scheduledFor.toISOString() : null,
        publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
        prompt: post.prompt
          ? {
              ...post.prompt,
              tags: post.prompt.tags.split(","),
              generationSettings: post.prompt.generationSettings
                ? JSON.parse(post.prompt.generationSettings)
                : undefined,
              createdAt: post.prompt.createdAt.toISOString(),
              updatedAt: post.prompt.updatedAt.toISOString(),
            }
          : undefined,
        instagramAccount: post.instagramAccount
          ? {
              id: post.instagramAccount.id,
              igUserId: post.instagramAccount.igUserId,
              username: post.instagramAccount.username,
              name: post.instagramAccount.name,
              profilePictureUrl: post.instagramAccount.profilePictureUrl,
              isConnected: post.instagramAccount.isConnected,
              permissions: post.instagramAccount.permissions,
              createdAt: post.instagramAccount.createdAt.toISOString(),
              updatedAt: post.instagramAccount.updatedAt.toISOString(),
            }
          : null,
      }));
    } catch (err: unknown) {
      console.error("Database error in getPosts:", err);
      return [];
    }
  },

  createPost: async (data: Omit<PostItem, "id" | "createdAt" | "updatedAt" | "retryCount">) => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      throw new DatabaseError(`Database connection unavailable: ${dbCheck.message}. Post write could not be confirmed.`);
    }

    const post = await prisma.post.create({
      data: {
        promptId: data.promptId,
        instagramAccountId: data.instagramAccountId || null,
        caption: data.caption,
        hashtags: data.hashtags,
        commentKeyword: data.commentKeyword.toUpperCase(),
        mediaType: data.mediaType || "IMAGE",
        temporaryImageUrl: data.temporaryImageUrl,
        temporaryAssetKey: data.temporaryAssetKey,
        instagramMediaId: data.instagramMediaId || null,
        instagramPermalink: data.instagramPermalink || null,
        status: data.status,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        errorMessage: data.errorMessage || null,
      },
    });

    return {
      ...post,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      scheduledFor: post.scheduledFor?.toISOString() || null,
      publishedAt: post.publishedAt?.toISOString() || null,
    };
  },

  updatePost: async (id: string, data: Partial<PostItem>) => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      throw new DatabaseError(`Database connection unavailable: ${dbCheck.message}. Post update could not be confirmed.`);
    }

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...(data.caption && { caption: data.caption }),
        ...(data.hashtags && { hashtags: data.hashtags }),
        ...(data.commentKeyword && { commentKeyword: data.commentKeyword.toUpperCase() }),
        ...(data.status && { status: data.status }),
        ...(data.instagramMediaId !== undefined && { instagramMediaId: data.instagramMediaId }),
        ...(data.instagramPermalink !== undefined && { instagramPermalink: data.instagramPermalink }),
        ...(data.scheduledFor !== undefined && {
          scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
        }),
        ...(data.publishedAt !== undefined && {
          publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        }),
        ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
      },
    });

    return {
      ...post,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      scheduledFor: post.scheduledFor?.toISOString() || null,
      publishedAt: post.publishedAt?.toISOString() || null,
    };
  },

  // AUTOMATION REQUESTS / INBOX
  getPromptRequests: async () => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      return [];
    }

    try {
      const items = await prisma.promptRequest.findMany({
        include: { matchedPost: true, matchedPrompt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return items.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        deliveredAt: r.deliveredAt?.toISOString() || null,
        matchedPrompt: r.matchedPrompt
          ? {
              ...r.matchedPrompt,
              tags: r.matchedPrompt.tags.split(","),
              generationSettings: r.matchedPrompt.generationSettings
                ? JSON.parse(r.matchedPrompt.generationSettings)
                : undefined,
              createdAt: r.matchedPrompt.createdAt.toISOString(),
              updatedAt: r.matchedPrompt.updatedAt.toISOString(),
            }
          : undefined,
        matchedPost: r.matchedPost
          ? {
              ...r.matchedPost,
              createdAt: r.matchedPost.createdAt.toISOString(),
              updatedAt: r.matchedPost.updatedAt.toISOString(),
              scheduledFor: r.matchedPost.scheduledFor?.toISOString() || null,
              publishedAt: r.matchedPost.publishedAt?.toISOString() || null,
            }
          : undefined,
      }));
    } catch (err: unknown) {
      console.error("Database query failed in getPromptRequests:", err);
      return [];
    }
  },

  createPromptRequest: async (data: Omit<PromptRequestItem, "id" | "createdAt">) => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      throw new DatabaseError(`Database connection unavailable: ${dbCheck.message}. Prompt request write could not be confirmed.`);
    }

    const req = await prisma.promptRequest.create({
      data: {
        incomingCommentId: data.incomingCommentId,
        instagramMediaId: data.instagramMediaId,
        commenterId: data.commenterId,
        commentText: data.commentText,
        matchedPostId: data.matchedPostId,
        matchedPromptId: data.matchedPromptId,
        deliveryStatus: data.deliveryStatus,
        deliveryMethod: data.deliveryMethod,
        privateReplyId: data.privateReplyId,
        errorMessage: data.errorMessage,
        deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : null,
      },
    });

    return {
      ...req,
      createdAt: req.createdAt.toISOString(),
      deliveredAt: req.deliveredAt?.toISOString() || null,
    };
  },

  updatePromptRequest: async (
    id: string,
    data: Partial<{
      deliveryStatus: PromptRequestItem["deliveryStatus"];
      privateReplyId: string | null;
      errorMessage: string | null;
      deliveredAt: string | null;
      retryCount: number;
    }>
  ) => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      throw new DatabaseError(`Database connection unavailable: ${dbCheck.message}. Prompt request update could not be confirmed.`);
    }

    const updated = await prisma.promptRequest.update({
      where: { id },
      data: {
        ...(data.deliveryStatus && { deliveryStatus: data.deliveryStatus }),
        ...(data.privateReplyId !== undefined && { privateReplyId: data.privateReplyId }),
        ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
        ...(data.deliveredAt !== undefined && {
          deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : null,
        }),
        ...(data.retryCount !== undefined && { retryCount: data.retryCount }),
      },
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      deliveredAt: updated.deliveredAt?.toISOString() || null,
    };
  },

  // SETTINGS & METRICS
  getAutomationSettings: async (): Promise<AutomationSettingItem> => {
    const defaultSettings: AutomationSettingItem = {
      id: "default-automation-setting",
      instagramAccountId: null,
      isAutomationEnabled: true,
      globalKeyword: "PROMPT",
      replyTemplate: "Here is the photography prompt you requested: {prompt_url}",
      maxRepliesPerCommenter: 1,
      retentionHours: 24,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const settings = await prisma.automationSetting.findFirst();
        if (settings) {
          return {
            ...settings,
            createdAt: settings.createdAt.toISOString(),
            updatedAt: settings.updatedAt.toISOString(),
          };
        }
      }
    } catch (err: unknown) {
      console.warn("Could not retrieve automation settings from DB, using default schema:", err);
    }

    return defaultSettings;
  },

  updateAutomationSettings: async (data: Partial<AutomationSettingItem>): Promise<AutomationSettingItem> => {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      throw new DatabaseError(`Database connection unavailable: ${dbCheck.message}. Settings save could not be confirmed.`);
    }

    const existing = await prisma.automationSetting.findFirst();
    let updated;

    if (existing) {
      updated = await prisma.automationSetting.update({
        where: { id: existing.id },
        data: {
          ...(data.isAutomationEnabled !== undefined && { isAutomationEnabled: data.isAutomationEnabled }),
          ...(data.globalKeyword && { globalKeyword: data.globalKeyword.toUpperCase() }),
          ...(data.replyTemplate && { replyTemplate: data.replyTemplate }),
          ...(data.maxRepliesPerCommenter && { maxRepliesPerCommenter: data.maxRepliesPerCommenter }),
          ...(data.retentionHours && { retentionHours: data.retentionHours }),
        },
      });
    } else {
      updated = await prisma.automationSetting.create({
        data: {
          isAutomationEnabled: data.isAutomationEnabled ?? true,
          globalKeyword: (data.globalKeyword || "PROMPT").toUpperCase(),
          replyTemplate: data.replyTemplate || "Here is the photography prompt you requested: {prompt_url}",
          maxRepliesPerCommenter: data.maxRepliesPerCommenter ?? 1,
          retentionHours: data.retentionHours ?? 24,
        },
      });
    }

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  },

  // DASHBOARD SUMMARY METRICS
  getDashboardMetrics: async () => {
    const prompts = await dbService.getPrompts({ includeArchived: true });
    const posts = await dbService.getPosts();
    const requests = await dbService.getPromptRequests();

    const totalPrompts = prompts.length;
    const publishedPosts = posts.filter((p) => p.status === "PUBLISHED").length;
    const scheduledPosts = posts.filter((p) => p.status === "SCHEDULED").length;
    const incomingRequests = requests.length;
    const successfulDeliveries = requests.filter((r) => r.deliveryStatus === "DELIVERED").length;
    const deliveryFailures = requests.filter((r) => r.deliveryStatus === "FAILED").length;

    let recentActivity: ActivityLogItem[] = [];
    const dbCheck = await checkDatabaseConnection();
    if (dbCheck.ok) {
      try {
        const logs = await prisma.activityLog.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
        });
        recentActivity = logs.map((l) => ({
          id: l.id,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          details: l.details ? JSON.parse(l.details) : null,
          userId: l.userId,
          createdAt: l.createdAt.toISOString(),
        }));
      } catch {
        // Empty if no logs
      }
    }

    return {
      totalPrompts,
      publishedPosts,
      scheduledPosts,
      incomingRequests,
      successfulDeliveries,
      deliveryFailures,
      recentActivity,
    };
  },
};
