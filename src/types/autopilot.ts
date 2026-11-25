export interface AutopilotTheme {
  id: string;
  label: string;
}

export const AUTOPILOT_THEMES: AutopilotTheme[] = [
  { id: "random", label: "🎲 Surprise Me (Random Fresh Concept)" },
  { id: "cinematic-portraits", label: "🎬 Cinematic Golden-Hour Portrait" },
  { id: "bridal-romance", label: "💍 Romantic Vineyard Bridal Editorial" },
  { id: "haute-couture", label: "✨ Avant-Garde High-Fashion Studio" },
  { id: "cyberpunk-urban", label: "🏙️ Rainy Neon Cyberpunk Street" },
  { id: "fine-art-botanical", label: "🌿 Minimalist Botanical Fine-Art" },
  { id: "dramatic-chiaroscuro", label: "💡 Moody Chiaroscuro & Shadowplay" },
];

export interface AutopilotPromptIdea {
  title: string;
  originalPrompt: string;
  imagenPrompt: string;
  category: string;
  tags: string[];
  suggestedKeyword: string;
  cameraModel?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  lightingSetup?: string;
  renderingEngine?: string;
}

export interface AutopilotExecutionOptions {
  theme?: string;
  category?: string;
  commentKeyword?: string;
  instagramHandle?: string;
  autoPublish?: boolean;
}

export interface AutopilotExecutionResult {
  success: boolean;
  prompt: {
    id: string;
    title: string;
    slug: string;
    originalPrompt: string;
    sourceImageUrl: string;
    publicUrl: string;
  };
  post: {
    id: string;
    status: string;
    caption: string;
    hashtags: string;
    commentKeyword: string;
    renderedImageUrl: string;
    instagramPermalink?: string;
  };
  redirectUrl: string;
}
