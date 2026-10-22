import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Photographer Prompt Hub database...");

  // 1. Create or update Default Admin User
  const adminEmail = process.env.ADMIN_EMAIL || "admin@photographerprompthub.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "PhotographerPromptAdmin2026!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      name: "Photography Director",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Admin user ensured: ${admin.email}`);

  // 2. Initial Automation Settings
  await prisma.automationSetting.upsert({
    where: { id: "default-automation-setting" },
    update: {},
    create: {
      id: "default-automation-setting",
      isAutomationEnabled: true,
      globalKeyword: "PROMPT",
      replyTemplate: "Here is the photography prompt you requested: {prompt_url}",
      maxRepliesPerCommenter: 1,
      retentionHours: 24,
    },
  });

  // 3. Seed High-End Photography Prompts
  const promptsData = [
    {
      title: "Golden Hour Tuscan Vineyard Bridal Portrait",
      originalPrompt:
        "High-end editorial bridal portrait in a rolling Tuscan vineyard at golden hour, bride wearing an intricate ivory lace backless gown by Elie Saab, gentle warm backlight glowing through veil, soft breeze catching silk tulle, Canon EOS R5, RF 85mm f/1.2L USM, f/1.4, 1/800s, ISO 100, Kodak Portra 400 film tones, ultra-realistic skin texture, romantic cinematic depth of field, hyper-detailed drapery.",
      category: "Wedding and bridal",
      tags: "bridal,tuscan,golden-hour,lace-gown,canon-85mm,cinematic",
      generationSettings: JSON.stringify({
        aspectRatio: "4:5",
        camera: "Canon EOS R5",
        lens: "85mm f/1.2",
        lighting: "Warm rim backlight, soft diffused golden hour",
        engine: "Midjourney v6.1 / Flux.1 Schnell",
      }),
      slug: "golden-hour-tuscan-vineyard-bridal-portrait",
    },
    {
      title: "Moody Rainy Streets Paris Pre-Wedding",
      originalPrompt:
        "Cinematic 35mm street photography couple portrait under a vintage black umbrella in the rain near Pont Alexandre III in Paris, glistening cobblestones reflecting warm amber street lanterns and distant Eiffel Tower glow, stylish tailored trench coats, romantic eye contact, mist, shallow depth of field, Leica M11, Noctilux-M 50mm f/0.95 ASPH, cinematic color grading, film grain, emotional atmosphere.",
      category: "Couple and pre-wedding",
      tags: "couple,paris,rain,umbrella,leica,moody,cinematic",
      generationSettings: JSON.stringify({
        aspectRatio: "4:5",
        camera: "Leica M11",
        lens: "50mm f/0.95",
        lighting: "Wet asphalt reflections, warm streetlamps, ambient mist",
        engine: "Midjourney v6.1",
      }),
      slug: "moody-rainy-streets-paris-pre-wedding",
    },
    {
      title: "Avant-Garde Architectural Haute Couture Editorial",
      originalPrompt:
        "High fashion editorial in an open concrete Brutalist pavilion, haute couture structured metallic organza silhouette dress in iridescent champagne and charcoal, striking dynamic pose, sharp architectural shadows from midday sun, Hasselblad H6D-100c, HC 100mm f/2.2, crisp studio-grade clarity, Vogue Italia aesthetic, polished clean styling.",
      category: "Fashion and editorial",
      tags: "fashion,haute-couture,brutalist,hasselblad,vogue,editorial",
      generationSettings: JSON.stringify({
        aspectRatio: "4:5",
        camera: "Hasselblad H6D-100c",
        lens: "HC 100mm f/2.2",
        lighting: "Hard directional daylight with sculpted brutalist geometry",
        engine: "Flux.1 Dev",
      }),
      slug: "avant-garde-architectural-haute-couture-editorial",
    },
    {
      title: "Fine Art Botanical Studio Maternity",
      originalPrompt:
        "Fine art maternity portrait in a minimalist studio, expectant mother wrapped in delicate translucent ochre silk chiffon floating gracefully around silhouette, surrounded by lush monstera and eucalyptus botanicals, soft Rembrandt light from large north-facing window, Sony A7R V, FE 50mm f/1.2 GM, serene and empowering expression, velvet dark background, muted earth tones.",
      category: "Maternity",
      tags: "maternity,fine-art,chiffon,botanical,rembrandt-light,sony",
      generationSettings: JSON.stringify({
        aspectRatio: "4:5",
        camera: "Sony A7R V",
        lens: "50mm f/1.2 GM",
        lighting: "Large north-facing diffused softbox / window",
        engine: "Midjourney v6.1",
      }),
      slug: "fine-art-botanical-studio-maternity",
    },
    {
      title: "Organic Wool Knit Sleeping Newborn",
      originalPrompt:
        "Peaceful macro portrait of a newborn infant sleeping swaddled in chunky hand-knit cream merino wool, resting on an unbleached linen bed, delicate baby eyelashes in sharp focus, warm natural side light from a low window, gentle feather-light shadows, Nikon Z9, Nikkor Z MC 105mm f/2.8 VR S, macro detail, soft pastel palette, pristine organic warmth.",
      category: "Newborn and baby",
      tags: "newborn,macro,merino-wool,natural-light,nikon,serene",
      generationSettings: JSON.stringify({
        aspectRatio: "1:1",
        camera: "Nikon Z9",
        lens: "105mm f/2.8 VR Micro",
        lighting: "Soft indirect morning window light",
        engine: "Flux.1 Dev",
      }),
      slug: "organic-wool-knit-sleeping-newborn",
    },
    {
      title: "Autumn Coastal Cliffside Family Lifestyle",
      originalPrompt:
        "Candid authentic family of four walking along a rugged Pacific Northwest coastal cliff at dusk, parents holding hands with two young children laughing, cozy cable-knit sweaters and earthy beanies, dramatic stormy waves crashing below, misty atmospheric sea spray, Fujifilm GFX 100 II, GF 45-100mm f/4 R LM OIS WR, raw emotional documentary feeling, rich PNW emerald and driftwood tones.",
      category: "Family portraits",
      tags: "family,coastal,pacific-northwest,fujifilm-gfx,documentary,candid",
      generationSettings: JSON.stringify({
        aspectRatio: "4:5",
        camera: "Fujifilm GFX 100 II",
        lens: "GF 45-100mm f/4",
        lighting: "Overcast twilight blue hour with ambient surf reflection",
        engine: "Midjourney v6.1",
      }),
      slug: "autumn-coastal-cliffside-family-lifestyle",
    },
    {
      title: "Neon Cyberpunk Noir Cinematic Portrait",
      originalPrompt:
        "Cinematic moody low-key portrait of a contemplative subject by a rain-slicked Tokyo alley window, split lighting with cyan neon signs reflecting on wet cheekbones and warm amber incandescent rim light, shallow focus on raindrop condensation on window glass, Arri Alexa Mini LF, Cooke Anamorphic /i 40mm T2.3, authentic horizontal anamorphic blue streak flares, rich cinema shadows.",
      category: "Cinematic portraits",
      tags: "cinematic,cyberpunk,neon,rain,anamorphic,arri,tokyo",
      generationSettings: JSON.stringify({
        aspectRatio: "16:9",
        camera: "Arri Alexa Mini LF",
        lens: "Cooke Anamorphic /i 40mm",
        lighting: "Dual-tone neon cyan & warm tungsten split",
        engine: "Midjourney v6.1",
      }),
      slug: "neon-cyberpunk-noir-cinematic-portrait",
    },
    {
      title: "Luxury Horology Floating In Water Droplets",
      originalPrompt:
        "Commercial macro product photograph of a luxury skeleton automatic chronograph watch suspended above ripples of black liquid water, crisp micro water splashes frozen in mid-air, dial reflections highlighting rose gold bevels and sapphire crystal, Broncolor studio flash setup with honeycomb snoot, Phase One IQ4 150MP, 120mm Macro f/4, f/16, ultra-sharp precision, high-end Swiss advertising standard.",
      category: "Product photography",
      tags: "product,luxury-watch,macro,splash,broncolor,phase-one",
      generationSettings: JSON.stringify({
        aspectRatio: "1:1",
        camera: "Phase One IQ4 150MP",
        lens: "Schneider Kreuznach 120mm Macro",
        lighting: "High-speed sync strobe with parabolic reflector and strip gridded boxes",
        engine: "Flux.1 Pro",
      }),
      slug: "luxury-horology-floating-in-water-droplets",
    },
    {
      title: "Chiaroscuro Prismatic Glass Creative Lighting",
      originalPrompt:
        "Creative editorial studio portrait experimenting with optical refraction, face partially obscured by faceted crystal prisms casting rainbow caustics across eyes and cheek, dramatic Chiaroscuro hard key light through patterned Venetian blinds, deep obsidian shadows, Canon EOS 5D Mark IV, EF 85mm f/1.4L IS USM, experimental art gallery aesthetic, striking visual rhythm.",
      category: "Creative lighting",
      tags: "creative-lighting,prisms,refraction,chiaroscuro,caustics,studio",
      generationSettings: JSON.stringify({
        aspectRatio: "4:5",
        camera: "Canon EOS 5D Mark IV",
        lens: "85mm f/1.4L",
        lighting: "Hard optical spot through crystal prisms + venetian blind gobo",
        engine: "Midjourney v6.1",
      }),
      slug: "chiaroscuro-prismatic-glass-creative-lighting",
    },
    {
      title: "Monochrome Sculptural Ballet Studio Portrait",
      originalPrompt:
        "Sculptural black and white studio portrait of a classical male ballet dancer in mid-leap tension, muscular anatomy highlighted with sharp rim lighting against pitch black backdrop, subtle chalk dust freezing in air, high contrast monochrome with deep blacks and luminous highlights, Hasselblad 907X 50C, XCD 90mm f/3.2, timeless physical poetry, tribute to Herb Ritts.",
      category: "Studio photography",
      tags: "studio,black-and-white,dance,ballet,herb-ritts,monochrome",
      generationSettings: JSON.stringify({
        aspectRatio: "4:5",
        camera: "Hasselblad 907X",
        lens: "XCD 90mm f/3.2",
        lighting: "Dual high-powered rim strobes with edge kickers",
        engine: "Midjourney v6.1",
      }),
      slug: "monochrome-sculptural-ballet-studio-portrait",
    },
  ];

  for (const item of promptsData) {
    const prompt = await prisma.prompt.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        ...item,
        viewCount: Math.floor(Math.random() * 250) + 40,
        copyCount: Math.floor(Math.random() * 85) + 12,
      },
    });

    // Create a sample post for Tuscan bridal
    if (item.slug === "golden-hour-tuscan-vineyard-bridal-portrait") {
      const existingPost = await prisma.post.findFirst({
        where: { promptId: prompt.id },
      });

      if (!existingPost) {
        const post = await prisma.post.create({
          data: {
            promptId: prompt.id,
            caption:
              "Sunlight filtering through centuries-old Tuscan vines. When golden hour delivers poetry like this, magic happens.\n\nComment BRIDAL to receive the exact lens, lighting setup, and camera prompt directly in your DMs.",
            hashtags: "#weddingphotography #bridalportrait #goldenhourphotographer #tuscanwedding #portraitlighting",
            commentKeyword: "BRIDAL",
            status: "PUBLISHED",
            publishedAt: new Date(Date.now() - 3600 * 1000 * 24 * 2), // 2 days ago
            instagramMediaId: "18029384756201948",
            instagramPermalink: "https://www.instagram.com/p/C3x9L0mK1az/",
          },
        });

        // Add a sample delivered prompt request
        await prisma.promptRequest.upsert({
          where: { incomingCommentId: "ig_comment_991827364" },
          update: {},
          create: {
            incomingCommentId: "ig_comment_991827364",
            instagramMediaId: post.instagramMediaId!,
            commenterId: "ig_user_449201928",
            commentText: "BRIDAL please! Loving the rim backlight tones",
            matchedPostId: post.id,
            matchedPromptId: prompt.id,
            deliveryStatus: "DELIVERED",
            deliveryMethod: "PRIVATE_REPLY",
            privateReplyId: "msg_ig_8829102",
            deliveredAt: new Date(Date.now() - 3600 * 1000 * 23),
          },
        });
      }
    }
  }

  console.log("Database seeded successfully with photography prompts and test data.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
