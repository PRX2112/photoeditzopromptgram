import { prisma } from "@/lib/prisma";

/**
 * Normalizes any title string into a URL-safe, lowercase slug.
 * Example: "The Candid Walk & Laugh — Hand-in-Hand" -> "the-candid-walk-laugh-hand-in-hand"
 */
export function normalizeSlug(title: string): string {
  if (!title || typeof title !== "string") {
    return `prompt-${Date.now().toString(36)}`;
  }

  const slug = title
    .toLowerCase()
    .normalize("NFKD") // Decompose Unicode diacritics
    .replace(/[\u0300-\u036f]/g, "") // Remove accent marks
    .replace(/[—–]/g, "-") // Convert em-dash and en-dash to hyphen
    .replace(/&/g, " ") // Convert ampersand to space
    .replace(/[^a-z0-9\s-]/g, "") // Remove all non-alphanumeric chars except space and hyphen
    .trim()
    .replace(/[\s-]+/g, "-") // Collapse consecutive spaces and hyphens into single hyphen
    .replace(/^-+|-+$/g, ""); // Trim leading and trailing hyphens

  return slug || `prompt-${Date.now().toString(36)}`;
}

/**
 * Generates a unique, collision-safe slug for a prompt.
 * If the generated slug already exists for another prompt, appends -2, -3, etc.
 * 
 * @param title - The title to slugify
 * @param excludeId - Optional prompt ID to exclude from collision checks (for edits)
 * @param existenceChecker - Optional custom existence checker for unit testing without DB
 */
export async function generateUniqueSlug(
  title: string,
  excludeId?: string,
  existenceChecker?: (slug: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = normalizeSlug(title);
  let candidate = baseSlug;
  let counter = 1;

  const checkExists =
    existenceChecker ||
    (async (slugToCheck: string) => {
      const existing = await prisma.prompt.findFirst({
        where: {
          slug: slugToCheck,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      return Boolean(existing);
    });

  while (await checkExists(candidate)) {
    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }

  return candidate;
}
