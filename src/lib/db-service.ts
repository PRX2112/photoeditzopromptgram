import { prisma, checkDatabaseConnection } from "./prisma";
import { encryptToken } from "./crypto";
import type {
  PromptItem,
  PostItem,
  PromptRequestItem,
  AutomationSettingItem,
  ActivityLogItem,
  InstagramAccountItem,
  DeliveryStatus,
  DMReservationStatus,
} from "@/types";

// Initial seed prompts for fallback/offline/local development
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
    viewCount: 342,
    copyCount: 94,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
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
    viewCount: 289,
    copyCount: 78,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
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
    viewCount: 412,
    copyCount: 115,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
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
    viewCount: 198,
    copyCount: 42,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
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
    viewCount: 156,
    copyCount: 38,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
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
    viewCount: 220,
    copyCount: 51,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
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
    viewCount: 480,
    copyCount: 162,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
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
    viewCount: 310,
    copyCount: 88,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
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
    viewCount: 265,
    copyCount: 72,
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
    viewCount: 184,
    copyCount: 45,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// In-memory fallback state
const memoryState = {
  prompts: [...INITIAL_PROMPTS],
  posts: [
    {
      id: "post-1",
      promptId: "p-1",
      caption:
        "Sunlight filtering through centuries-old Tuscan vines. When golden hour delivers poetry like this, magic happens.\n\nComment BRIDAL to receive the exact lens, lighting setup, and camera prompt directly in your DMs.",
      hashtags: "#weddingphotography #bridalportrait #goldenhourphotographer #tuscanwedding #portraitlighting",
      commentKeyword: "BRIDAL",
      mediaType: "IMAGE",
      temporaryImageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
      instagramMediaId: "18029384756201948",
      instagramPermalink: "https://www.instagram.com/p/C3x9L0mK1az/",
      status: "PUBLISHED" as const,
      scheduledFor: null,
      publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      errorMessage: null,
      retryCount: 0,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "post-2",
      promptId: "p-3",
      caption:
        "Structural geometry meets Haute Couture. Exploring the contrast between raw Brutalist architecture and liquid champagne organza.\n\nComment EDITORIAL to get the full prompt and Hasselblad settings.",
      hashtags: "#fashioneditorial #hautecouture #brutalistarchitecture #vogueeditorial #editorialphotography",
      commentKeyword: "EDITORIAL",
      mediaType: "IMAGE",
      temporaryImageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80",
      instagramMediaId: null,
      instagramPermalink: null,
      status: "SCHEDULED" as const,
      scheduledFor: new Date(Date.now() + 86400000 * 1).toISOString(),
      publishedAt: null,
      errorMessage: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ] as PostItem[],
  promptRequests: [
    {
      id: "req-1",
      incomingCommentId: "ig_comment_991827364",
      instagramMediaId: "18029384756201948",
      commenterId: "ig_user_449201928",
      commentText: "BRIDAL please! Loving the rim backlight tones",
      matchedPostId: "post-1",
      matchedPromptId: "p-1",
      deliveryStatus: "DELIVERED" as const,
      deliveryMethod: "PRIVATE_REPLY",
      privateReplyId: "msg_ig_8829102",
      retryCount: 0,
      errorMessage: null,
      deliveredAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: "req-2",
      incomingCommentId: "ig_comment_991827365",
      instagramMediaId: "18029384756201948",
      commenterId: "ig_user_771928391",
      commentText: "bridal send me the prompt",
      matchedPostId: "post-1",
      matchedPromptId: "p-1",
      deliveryStatus: "DELIVERED" as const,
      deliveryMethod: "PRIVATE_REPLY",
      privateReplyId: "msg_ig_8829103",
      retryCount: 0,
      errorMessage: null,
      deliveredAt: new Date(Date.now() - 3600000 * 14).toISOString(),
      createdAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    },
    {
      id: "req-3",
      incomingCommentId: "ig_comment_991827366",
      instagramMediaId: "18029384756201948",
      commenterId: "ig_user_332190123",
      commentText: "Bridal!!",
      matchedPostId: "post-1",
      matchedPromptId: "p-1",
      deliveryStatus: "DELIVERED" as const,
      deliveryMethod: "PRIVATE_REPLY",
      privateReplyId: "msg_ig_8829104",
      retryCount: 0,
      errorMessage: null,
      deliveredAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: "req-4",
      incomingCommentId: "ig_comment_991827367",
      instagramMediaId: "18029384756201948",
      commenterId: "ig_user_551029384",
      commentText: "Such a breathtaking shot!",
      matchedPostId: "post-1",
      matchedPromptId: "p-1",
      deliveryStatus: "IGNORED" as const,
      deliveryMethod: "NONE",
      privateReplyId: null,
      retryCount: 0,
      errorMessage: "No matching keyword found in comment",
      deliveredAt: null,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ] as PromptRequestItem[],
  automationSettings: {
    id: "default-automation-setting",
    isAutomationEnabled: true,
    globalKeyword: "PROMPT",
    replyTemplate: "Here is the photography prompt you requested: {prompt_url}",
    maxRepliesPerCommenter: 1,
    retentionHours: 24,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as AutomationSettingItem,
  instagramAccount: {
    id: "acc-1",
    igUserId: process.env.META_INSTAGRAM_ACCOUNT_ID || "17841479958291582",
    username: "prx_dev",
    name: "PRX DEV >/",
    profilePictureUrl: "https://scontent.fstv8-1.fna.fbcdn.net/v/t51.82787-15/610118694_17845212354665277_4384744227790364140_n.jpg?_nc_cat=107&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=7d201b&_nc_ohc=HYJk0w_2DnAQ7kNvwHgqGBH&_nc_oc=Adq38M-2BB5njvhBIv-Ohj8QHNW23uzrYS1jFAWO-0LjUmoNsv9D8Vmerk4B-DnIbkcriU2tQDzbyD3Z0m6UYLaH&_nc_zt=23&_nc_ht=scontent.fstv8-1.fna&edm=AL-3X8kEAAAA&_nc_gid=xf7amAmmyHwrA4VnhGoNzQ&oh=00_AQODg6khE7K8p6Xfco_S1QvoaHVNt_TC1YyHlkSVLTDBYw&oe=6AE13F29",
    isConnected: true,
    permissions: "instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_contents,pages_show_list,pages_read_engagement",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as InstagramAccountItem,
  activityLogs: [
    {
      id: "log-1",
      action: "POST_PUBLISHED",
      entityType: "Post",
      entityId: "post-1",
      details: { caption: "Sunlight filtering through centuries-old Tuscan vines..." },
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "log-2",
      action: "PRIVATE_REPLY_SENT",
      entityType: "PromptRequest",
      entityId: "req-1",
      details: { keyword: "BRIDAL", promptSlug: "golden-hour-tuscan-vineyard-bridal-portrait" },
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: "log-3",
      action: "POST_SCHEDULED",
      entityType: "Post",
      entityId: "post-2",
      details: { scheduledFor: new Date(Date.now() + 86400000).toISOString() },
      createdAt: new Date().toISOString(),
    },
  ] as ActivityLogItem[],
};

export const dbService = {
  // Check database health
  checkHealth: async () => {
    return checkDatabaseConnection();
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

        return items.map((p) => ({
          ...p,
          tags: p.tags ? p.tags.split(",").map((t) => t.trim()) : [],
          generationSettings: p.generationSettings ? JSON.parse(p.generationSettings) : undefined,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }));
      }
    } catch {
      // Fallback
    }

    // In-memory fallback
    let list = memoryState.prompts;
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
    } catch {
      // Fallback
    }

    return memoryState.prompts.find((p) => p.id === id) || null;
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
    } catch {
      // Fallback
    }

    const item = memoryState.prompts.find((p) => p.slug === slug);
    if (!item) return null;

    const matchedPost = memoryState.posts.find(
      (post) => post.promptId === item.id && post.status === "PUBLISHED"
    );

    return {
      ...item,
      latestPost: matchedPost
        ? { instagramPermalink: matchedPost.instagramPermalink, publishedAt: matchedPost.publishedAt }
        : null,
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
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
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
      }
    } catch {
      // Fallback
    }

    const newItem: PromptItem = {
      id: `p-${Date.now()}`,
      title: data.title,
      originalPrompt: data.originalPrompt,
      category: data.category,
      tags: data.tags,
      generationSettings: data.generationSettings,
      slug: data.slug,
      isArchived: false,
      viewCount: 0,
      copyCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryState.prompts.unshift(newItem);
    return newItem;
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
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
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
      }
    } catch {
      // Fallback
    }

    const idx = memoryState.prompts.findIndex((p) => p.id === id);
    if (idx !== -1) {
      memoryState.prompts[idx] = {
        ...memoryState.prompts[idx],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return memoryState.prompts[idx];
    }
    return null;
  },

  incrementPromptCopies: async (slug: string) => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        await prisma.prompt.update({
          where: { slug },
          data: { copyCount: { increment: 1 } },
        });
        return;
      }
    } catch {
      // Fallback
    }

    const item = memoryState.prompts.find((p) => p.slug === slug);
    if (item) {
      item.copyCount += 1;
    }
  },

  incrementPromptViews: async (slug: string) => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        await prisma.prompt.update({
          where: { slug },
          data: { viewCount: { increment: 1 } },
        });
        return;
      }
    } catch {
      // Fallback
    }

    const item = memoryState.prompts.find((p) => p.slug === slug);
    if (item) {
      item.viewCount += 1;
    }
  },

  // POSTS
  getPosts: async (options?: { status?: string }) => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const where: Record<string, unknown> = {};
        if (options?.status && options.status !== "ALL") {
          where.status = options.status;
        }
        const items = await prisma.post.findMany({
          where,
          include: { prompt: true },
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
        }));
      }
    } catch {
      // Fallback
    }

    let list = memoryState.posts;
    if (options?.status && options.status !== "ALL") {
      list = list.filter((p) => p.status === options.status);
    }
    return list.map((post) => {
      const prompt = memoryState.prompts.find((p) => p.id === post.promptId);
      return { ...post, prompt };
    });
  },

  createPost: async (data: Omit<PostItem, "id" | "createdAt" | "updatedAt" | "retryCount">) => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const activeAccount = await prisma.instagramAccount.findFirst({
          where: { isConnected: true },
        });

        const post = await prisma.post.create({
          data: {
            promptId: data.promptId,
            instagramAccountId: activeAccount?.id || null,
            caption: data.caption,
            hashtags: data.hashtags,
            commentKeyword: data.commentKeyword.toUpperCase(),
            mediaType: data.mediaType || "IMAGE",
            blobUrl: data.blobUrl || data.temporaryImageUrl,
            blobPathname: data.blobPathname,
            temporaryImageUrl: data.blobUrl || data.temporaryImageUrl,
            temporaryAssetKey: data.temporaryAssetKey,
            imageUploadedAt: data.imageUploadedAt ? new Date(data.imageUploadedAt) : new Date(),
            imageLifecycleStatus: data.imageLifecycleStatus || "UPLOADED",
            status: data.status,
            scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
            publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
          },
        });
        return {
          ...post,
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
          imageUploadedAt: post.imageUploadedAt?.toISOString() || null,
          imageDeletedAt: post.imageDeletedAt?.toISOString() || null,
          scheduledFor: post.scheduledFor?.toISOString() || null,
          publishedAt: post.publishedAt?.toISOString() || null,
        };
      }
    } catch {
      // Fallback
    }

    const newPost: PostItem = {
      ...data,
      id: `post-${Date.now()}`,
      commentKeyword: data.commentKeyword.toUpperCase(),
      blobUrl: data.blobUrl || data.temporaryImageUrl,
      imageLifecycleStatus: data.imageLifecycleStatus || "UPLOADED",
      cleanupAttempts: 0,
      publicationAttempts: 0,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryState.posts.unshift(newPost);
    return newPost;
  },

  updatePost: async (id: string, data: Partial<PostItem>) => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const post = await prisma.post.update({
          where: { id },
          data: {
            ...(data.caption && { caption: data.caption }),
            ...(data.hashtags && { hashtags: data.hashtags }),
            ...(data.commentKeyword && { commentKeyword: data.commentKeyword.toUpperCase() }),
            ...(data.status && { status: data.status }),
            ...(data.blobUrl !== undefined && { blobUrl: data.blobUrl }),
            ...(data.blobPathname !== undefined && { blobPathname: data.blobPathname }),
            ...(data.temporaryImageUrl !== undefined && { temporaryImageUrl: data.temporaryImageUrl }),
            ...(data.imageLifecycleStatus && { imageLifecycleStatus: data.imageLifecycleStatus }),
            ...(data.imageDeletedAt !== undefined && {
              imageDeletedAt: data.imageDeletedAt ? new Date(data.imageDeletedAt) : null,
            }),
            ...(data.cleanupAttempts !== undefined && { cleanupAttempts: data.cleanupAttempts }),
            ...(data.lastCleanupError !== undefined && { lastCleanupError: data.lastCleanupError }),
            ...(data.containerId !== undefined && { containerId: data.containerId }),
            ...(data.instagramMediaId && { instagramMediaId: data.instagramMediaId }),
            ...(data.instagramPermalink && { instagramPermalink: data.instagramPermalink }),
            ...(data.scheduledFor !== undefined && {
              scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
            }),
            ...(data.publishedAt !== undefined && {
              publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
            }),
            ...(data.publicationAttempts !== undefined && { publicationAttempts: data.publicationAttempts }),
            ...(data.lastPublishError !== undefined && { lastPublishError: data.lastPublishError }),
            ...(data.reconciliationMetadata !== undefined && { reconciliationMetadata: data.reconciliationMetadata }),
            ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
          },
        });
        return {
          ...post,
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
          imageUploadedAt: post.imageUploadedAt?.toISOString() || null,
          imageDeletedAt: post.imageDeletedAt?.toISOString() || null,
          scheduledFor: post.scheduledFor?.toISOString() || null,
          publishedAt: post.publishedAt?.toISOString() || null,
        };
      }
    } catch {
      // Fallback
    }

    const idx = memoryState.posts.findIndex((p) => p.id === id);
    if (idx !== -1) {
      memoryState.posts[idx] = {
        ...memoryState.posts[idx],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return memoryState.posts[idx];
    }
    return null;
  },

  // AUTOMATION REQUESTS / INBOX
  getPromptRequests: async () => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const items = await prisma.promptRequest.findMany({
          include: { post: true, matchedPrompt: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        });

        return items.map((r) => ({
          ...r,
          postId: r.postId,
          matchedPostId: r.postId,
          matchedPost: r.post
            ? {
                ...r.post,
                createdAt: r.post.createdAt.toISOString(),
                updatedAt: r.post.updatedAt.toISOString(),
                scheduledFor: r.post.scheduledFor?.toISOString() || null,
                publishedAt: r.post.publishedAt?.toISOString() || null,
                imageUploadedAt: r.post.imageUploadedAt?.toISOString() || null,
                imageDeletedAt: r.post.imageDeletedAt?.toISOString() || null,
              }
            : undefined,
          incomingCommentId: r.firstCommentId || r.incomingCommentId,
          commenterId: r.instagramScopedUserId,
          deliveryStatus: r.deliveryStatus as DeliveryStatus,
          createdAt: r.createdAt.toISOString(),
          reservedAt: r.reservedAt?.toISOString() || null,
          sendingAt: r.sendingAt?.toISOString() || null,
          sentAt: r.sentAt?.toISOString() || null,
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
        }));
      }
    } catch {
      // Fallback
    }

    return memoryState.promptRequests.map((r) => {
      const post = memoryState.posts.find((p) => p.id === r.matchedPostId || p.id === r.postId);
      const prompt = memoryState.prompts.find((p) => p.id === r.matchedPromptId);
      return { ...r, matchedPost: post, matchedPrompt: prompt };
    });
  },

  createPromptRequest: async (data: Partial<PromptRequestItem>) => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok && data.postId && (data.instagramScopedUserId || data.commenterId)) {
        const scopedUserId = data.instagramScopedUserId || data.commenterId!;
        const req = await prisma.promptRequest.create({
          data: {
            postId: data.postId,
            instagramScopedUserId: scopedUserId,
            firstCommentId: data.firstCommentId || data.incomingCommentId || `comm_${Date.now()}`,
            firstCommentTimestamp: data.createdAt ? new Date(data.createdAt) : new Date(),
            incomingCommentId: data.incomingCommentId || data.firstCommentId,
            instagramMediaId: data.instagramMediaId,
            commentText: data.commentText,
            matchedPromptId: data.matchedPromptId,
            deliveryStatus: (data.deliveryStatus as DMReservationStatus) || "RESERVED",
            deliveryMethod: data.deliveryMethod || "PRIVATE_REPLY",
            privateReplyId: data.privateReplyId || data.metaMessageId,
            metaMessageId: data.metaMessageId || data.privateReplyId,
            lastError: data.lastError || data.errorMessage,
            errorMessage: data.errorMessage || data.lastError,
            deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : null,
          },
        });
        return {
          ...req,
          createdAt: req.createdAt.toISOString(),
          deliveredAt: req.deliveredAt?.toISOString() || null,
        };
      }
    } catch {
      // Fallback
    }

    const newReq: PromptRequestItem = {
      id: `req-${Date.now()}`,
      deliveryStatus: data.deliveryStatus || "RESERVED",
      createdAt: new Date().toISOString(),
      ...data,
    };
    memoryState.promptRequests.unshift(newReq);
    return newReq;
  },

  // SETTINGS & METRICS
  getAutomationSettings: async () => {
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
    } catch {
      // Fallback
    }
    return memoryState.automationSettings;
  },

  updateAutomationSettings: async (data: Partial<AutomationSettingItem>) => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const existing = await prisma.automationSetting.findFirst();
        if (existing) {
          const updated = await prisma.automationSetting.update({
            where: { id: existing.id },
            data: {
              ...(data.isAutomationEnabled !== undefined && { isAutomationEnabled: data.isAutomationEnabled }),
              ...(data.globalKeyword && { globalKeyword: data.globalKeyword.toUpperCase() }),
              ...(data.replyTemplate && { replyTemplate: data.replyTemplate }),
              ...(data.maxRepliesPerCommenter && { maxRepliesPerCommenter: data.maxRepliesPerCommenter }),
              ...(data.retentionHours && { retentionHours: data.retentionHours }),
            },
          });
          return {
            ...updated,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          };
        }
      }
    } catch {
      // Fallback
    }

    memoryState.automationSettings = {
      ...memoryState.automationSettings,
      ...data,
      globalKeyword: data.globalKeyword
        ? data.globalKeyword.toUpperCase()
        : memoryState.automationSettings.globalKeyword,
      updatedAt: new Date().toISOString(),
    };
    return memoryState.automationSettings;
  },

  // INSTAGRAM ACCOUNT MANAGEMENT
  getConnectedInstagramAccount: async (): Promise<InstagramAccountItem | null> => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const account = await prisma.instagramAccount.findFirst({
          where: { isConnected: true },
        });
        if (account) {
          return {
            id: account.id,
            igUserId: account.igUserId,
            username: account.username,
            name: account.name,
            profilePictureUrl: account.profilePictureUrl,
            isConnected: account.isConnected,
            permissions: account.permissions,
            createdAt: account.createdAt.toISOString(),
            updatedAt: account.updatedAt.toISOString(),
          };
        }
      }
    } catch {
      // Fallback
    }
    return memoryState.instagramAccount;
  },

  connectInstagramAccount: async (data: {
    igUserId: string;
    username: string;
    name?: string;
    profilePictureUrl?: string;
    accessToken: string;
    permissions?: string;
  }): Promise<InstagramAccountItem> => {
    const encryptedToken = data.accessToken.includes(":")
      ? data.accessToken
      : encryptToken(data.accessToken);

    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const adminUser = await prisma.user.findFirst();
        if (adminUser) {
          const account = await prisma.instagramAccount.upsert({
            where: { igUserId: data.igUserId },
            update: {
              username: data.username,
              name: data.name,
              profilePictureUrl: data.profilePictureUrl,
              accessTokenEncrypted: encryptedToken,
              isConnected: true,
              permissions: data.permissions || "instagram_basic,instagram_content_publish,instagram_manage_comments",
            },
            create: {
              userId: adminUser.id,
              igUserId: data.igUserId,
              username: data.username,
              name: data.name,
              profilePictureUrl: data.profilePictureUrl,
              accessTokenEncrypted: encryptedToken,
              isConnected: true,
              permissions: data.permissions || "instagram_basic,instagram_content_publish,instagram_manage_comments",
            },
          });

          const mapped: InstagramAccountItem = {
            id: account.id,
            igUserId: account.igUserId,
            username: account.username,
            name: account.name,
            profilePictureUrl: account.profilePictureUrl,
            isConnected: account.isConnected,
            permissions: account.permissions,
            createdAt: account.createdAt.toISOString(),
            updatedAt: account.updatedAt.toISOString(),
          };
          memoryState.instagramAccount = mapped;
          return mapped;
        }
      }
    } catch {
      // Fallback
    }

    const updatedMemory: InstagramAccountItem = {
      id: `acc-${Date.now()}`,
      igUserId: data.igUserId,
      username: data.username,
      name: data.name || null,
      profilePictureUrl: data.profilePictureUrl || null,
      isConnected: true,
      permissions: data.permissions || "instagram_basic,instagram_content_publish,instagram_manage_comments",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryState.instagramAccount = updatedMemory;
    return updatedMemory;
  },

  disconnectInstagramAccount: async (): Promise<void> => {
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        await prisma.instagramAccount.updateMany({
          data: { isConnected: false },
        });
      }
    } catch {
      // Fallback
    }
    if (memoryState.instagramAccount) {
      memoryState.instagramAccount.isConnected = false;
    }
  },

  // DASHBOARD SUMMARY METRICS
  getDashboardMetrics: async () => {
    const prompts = await dbService.getPrompts({ includeArchived: true });
    const posts = await dbService.getPosts();
    const requests = await dbService.getPromptRequests();

    const totalPrompts = prompts.length;
    const publishedPosts = posts.filter((p) => p.status === "PUBLISHED").length;
    const scheduledPosts = posts.filter((p) => p.status === "SCHEDULED").length;
    const publishingPosts = posts.filter((p) => p.status === "PUBLISHING").length;
    const failedPosts = posts.filter((p) => p.status === "FAILED").length;

    // Image lifecycle statuses
    const cleanupPendingCount = posts.filter((p) => p.imageLifecycleStatus === "CLEANUP_PENDING").length;
    const cleanupFailedCount = posts.filter((p) => p.imageLifecycleStatus === "CLEANUP_FAILED").length;
    const cleanupDeletedCount = posts.filter((p) => p.imageLifecycleStatus === "DELETED").length;
    const imageUploadedCount = posts.filter(
      (p) => p.imageLifecycleStatus === "UPLOADED" || p.imageLifecycleStatus === "READY_TO_PUBLISH"
    ).length;

    // DM & Automation metrics
    const incomingRequests = requests.length;
    const successfulDeliveries = requests.filter(
      (r) => r.deliveryStatus === "DELIVERED" || r.deliveryStatus === "SENT"
    ).length;
    const deliveryFailures = requests.filter((r) => r.deliveryStatus === "FAILED").length;
    const suppressedRequests = requests.filter((r) => r.deliveryStatus === "SUPPRESSED").length;
    const unknownDeliveries = requests.filter((r) => r.deliveryStatus === "UNKNOWN").length;
    const sendingDeliveries = requests.filter((r) => r.deliveryStatus === "SENDING").length;

    let webhookFailures = 0;
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        webhookFailures = await prisma.webhookEvent.count({
          where: { error: { not: null } },
        });
      }
    } catch {
      // Fallback
    }

    return {
      totalPrompts,
      publishedPosts,
      scheduledPosts,
      publishingPosts,
      failedPosts,
      incomingRequests,
      successfulDeliveries,
      deliveryFailures,
      suppressedRequests,
      unknownDeliveries,
      sendingDeliveries,
      cleanupPendingCount,
      cleanupFailedCount,
      cleanupDeletedCount,
      imageUploadedCount,
      webhookFailures,
      recentActivity: memoryState.activityLogs.slice(0, 5),
    };
  },
};
