import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { vercelBlobService } from "@/lib/storage/vercel-blob";

export interface RenderInstagramImageOptions {
  sourceImageUrlOrPath: string;
  title: string;
  instagramHandle?: string;
  commentKeyword?: string;
  ctaText?: string;
  outputWidth?: number;
  outputHeight?: number;
}

/**
 * Formats the CTA strip text rendered near the bottom of the photo.
 * E.g., when keyword is "BRIDAL", returns 'COMMENT "BRIDAL"'.
 */
export function formatImageCtaText(keyword?: string, customCta?: string): string {
  if (customCta && customCta.trim()) {
    return customCta.trim().toUpperCase();
  }
  const cleanKeyword = (keyword || "PROMPT").trim().toUpperCase();
  return `COMMENT "${cleanKeyword}"`;
}

export interface RenderInstagramImageResult {
  renderedBlobUrl: string;
  renderedBlobPathname: string;
  width: number;
  height: number;
  size: number;
  contentType: string;
}

/**
 * Resolves the path to the FFmpeg executable across environments:
 * 1. FFMPEG_PATH environment variable (if explicitly set)
 * 2. @ffmpeg-installer/ffmpeg bundled package
 * 3. System installed ffmpeg in PATH
 */
export function resolveFfmpegPath(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const installer = require("@ffmpeg-installer/ffmpeg");
    if (installer?.path && fs.existsSync(installer.path)) {
      return installer.path;
    }
  } catch {
    // Installer not available, continue to system check
  }

  // Check if ffmpeg exists in standard system paths
  const systemPaths: string[] = [];
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    systemPaths.push(path.join(localAppData, "Microsoft", "WinGet", "Links", "ffmpeg.exe"));
  }
  const programFiles = process.env["ProgramFiles"];
  if (programFiles) {
    systemPaths.push(path.join(programFiles, "ffmpeg", "bin", "ffmpeg.exe"));
  }
  systemPaths.push(
    path.join("/", "usr", "bin", "ffmpeg"),
    path.join("/", "usr", "local", "bin", "ffmpeg"),
    path.join("/", "opt", "homebrew", "bin", "ffmpeg")
  );

  for (const p of systemPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return "ffmpeg"; // Attempt direct invocation from PATH
}

/**
 * Resolves the TrueType font file path for drawtext.
 */
export function resolveFontPath(): string {
  const bundledPath = path.resolve(process.cwd(), "public", "fonts", "editorial-bold.ttf");
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  const winDir = process.env.WINDIR || process.env.SystemRoot;
  if (winDir) {
    const winArial = path.join(winDir, "Fonts", "arial.ttf");
    if (fs.existsSync(winArial)) {
      return winArial;
    }
  }

  // Linux system font fallback
  const linuxDir = path.join("/", "usr", "share", "fonts");
  const linuxFonts = [
    path.join(linuxDir, "truetype", "dejavu", "DejaVuSans-Bold.ttf"),
    path.join(linuxDir, "dejavu", "DejaVuSans-Bold.ttf"),
    path.join(linuxDir, "liberation", "LiberationSans-Bold.ttf"),
  ];
  for (const lf of linuxFonts) {
    if (fs.existsSync(lf)) return lf;
  }

  return bundledPath;
}

/**
 * Escapes a file path for safe inclusion in FFmpeg filter syntax.
 * Colons and backslashes must be escaped for FFmpeg filter parser.
 */
export function escapeFfmpegFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

/**
 * Word-wraps a title into lines of at most maxCharsPerLine, capped at maxLines.
 */
export function wrapTitle(text: string, maxCharsPerLine = 34, maxLines = 3): string[] {
  if (!text || typeof text !== "string") return ["UNTITLED PROMPT"];

  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) {
        break;
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text.slice(0, maxCharsPerLine)];
}

/**
 * Downloads a remote image URL to a local temporary file.
 */
async function downloadToTempFile(url: string): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `source-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download source image from ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));
  return tempPath;
}

/**
 * Renders an Instagram-ready 1080x1350 image using FFmpeg:
 * - 4:5 vertical portrait aspect ratio (Instagram standard)
 * - Main photo subject safely preserved without distortion or stretching
 * - Blurred background filling canvas
 * - Top header with prompt title
 * - Bottom footer with Instagram handle
 * - Uploads rendered JPEG to Vercel Blob
 */
export async function renderInstagramImage(
  options: RenderInstagramImageOptions
): Promise<RenderInstagramImageResult> {
  const {
    sourceImageUrlOrPath,
    title,
    instagramHandle = "@prx_dev",
    commentKeyword,
    ctaText,
    outputWidth = 1080,
    outputHeight = 1350,
  } = options;

  const ffmpegBin = resolveFfmpegPath();
  const fontPath = resolveFontPath();

  if (!fs.existsSync(fontPath)) {
    throw new Error(
      `Required typography font not found at ${fontPath}. Please ensure public/fonts/editorial-bold.ttf is bundled.`
    );
  }

  const isRemote = sourceImageUrlOrPath.startsWith("http://") || sourceImageUrlOrPath.startsWith("https://");
  let inputPath = sourceImageUrlOrPath;
  const tempFilesToClean: string[] = [];

  try {
    if (isRemote) {
      inputPath = await downloadToTempFile(sourceImageUrlOrPath);
      tempFilesToClean.push(inputPath);
    } else if (!fs.existsSync(inputPath)) {
      throw new Error(`Source image file does not exist at path: ${inputPath}`);
    }

    const outputTempPath = path.join(
      os.tmpdir(),
      `rendered-post-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    );
    tempFilesToClean.push(outputTempPath);

    // Prepare text files for drawtext to avoid shell injection and filter escaping bugs
    const lines = wrapTitle(title.toUpperCase(), 34, 3);
    const textFilePaths: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const linePath = path.join(os.tmpdir(), `title-line-${i}-${Date.now()}.txt`);
      fs.writeFileSync(linePath, lines[i], "utf8");
      tempFilesToClean.push(linePath);
      textFilePaths.push(escapeFfmpegFilterPath(linePath));
    }

    // Dynamic CTA strip text (e.g. COMMENT "BRIDAL")
    const dynamicCtaText = formatImageCtaText(commentKeyword, ctaText);
    const ctaPath = path.join(os.tmpdir(), `cta-${Date.now()}.txt`);
    fs.writeFileSync(ctaPath, dynamicCtaText, "utf8");
    tempFilesToClean.push(ctaPath);
    const escapedCtaPath = escapeFfmpegFilterPath(ctaPath);

    const cleanHandle = instagramHandle.startsWith("@") ? instagramHandle : `@${instagramHandle}`;
    const handlePath = path.join(os.tmpdir(), `handle-${Date.now()}.txt`);
    fs.writeFileSync(handlePath, `${cleanHandle.toUpperCase()}  |  PROMPT HUB`, "utf8");
    tempFilesToClean.push(handlePath);
    const escapedHandlePath = escapeFfmpegFilterPath(handlePath);

    const escapedFont = escapeFfmpegFilterPath(fontPath);

    // Calculate vertical positions for header title lines
    const titleFontSize = lines.length === 1 ? 38 : lines.length === 2 ? 32 : 28;
    const lineHeight = titleFontSize + 10;
    const totalTitleHeight = lines.length * lineHeight;
    const startY = Math.max(35, Math.round((180 - totalTitleHeight) / 2));

    // Construct complex filter graph
    const filterParts: string[] = [
      // 1. Create blurred background from the source image
      `[0:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase,crop=${outputWidth}:${outputHeight},boxblur=25:25,eq=brightness=-0.45[bg]`,
      // 2. Scale foreground image cleanly without distortion, fitting inside 1000x960
      `[0:v]scale=w=1000:h=960:force_original_aspect_ratio=decrease[fg]`,
      // 3. Composite foreground centered between header (180px) and footer (120px)
      `[bg][fg]overlay=(W-w)/2:180[comp]`,
      // 4. Header background bar (y=0 to 180)
      `[comp]drawbox=x=0:y=0:w=${outputWidth}:h=180:color=0x0a0c12@0.92:t=fill[h_bg]`,
    ];

    // 5. Draw each title line
    let prevLabel = "h_bg";
    for (let i = 0; i < lines.length; i++) {
      const nextLabel = `t_${i}`;
      const lineY = startY + i * lineHeight;
      filterParts.push(
        `[${prevLabel}]drawtext=fontfile='${escapedFont}':textfile='${textFilePaths[i]}':fontcolor=white:fontsize=${titleFontSize}:x=(w-text_w)/2:y=${lineY}:shadowcolor=black@0.8:shadowx=2:shadowy=2[${nextLabel}]`
      );
      prevLabel = nextLabel;
    }

    // 6. Action-Explaining CTA strip near bottom of photo, just above handle (y=1152 to 1226, height=74)
    // Dark glass strip with amber accent top border and bold phone-readable amber text (e.g. COMMENT "BRIDAL")
    filterParts.push(
      `[${prevLabel}]drawbox=x=0:y=1152:w=${outputWidth}:h=74:color=0x0c0f17@0.94:t=fill[cta_bg]`
    );
    filterParts.push(
      `[cta_bg]drawbox=x=0:y=1152:w=${outputWidth}:h=2:color=0xf59e0b@0.8:t=fill[cta_border]`
    );
    filterParts.push(
      `[cta_border]drawtext=fontfile='${escapedFont}':textfile='${escapedCtaPath}':fontcolor=0xfbbf24:fontsize=32:x=(w-text_w)/2:y=1173:shadowcolor=black@0.9:shadowx=2:shadowy=2[cta_out]`
    );

    // 7. Footer background bar (y=1226 to 1350, height=124) and handle branding
    filterParts.push(
      `[cta_out]drawbox=x=0:y=1226:w=${outputWidth}:h=124:color=0x07090e@0.96:t=fill[f_bg]`
    );
    filterParts.push(
      `[f_bg]drawtext=fontfile='${escapedFont}':textfile='${escapedHandlePath}':fontcolor=0x94a3b8:fontsize=22:x=(w-text_w)/2:y=1276:shadowcolor=black@0.8:shadowx=2:shadowy=2[out]`
    );

    const filterGraph = filterParts.join(";");

    // Execute FFmpeg safely using spawn (never shell exec)
    const ffmpegArgs = [
      "-y",
      "-i",
      inputPath,
      "-filter_complex",
      filterGraph,
      "-map",
      "[out]",
      "-frames:v",
      "1",
      "-q:v",
      "2", // High quality JPEG
      outputTempPath,
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegBin, ffmpegArgs, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";

      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      proc.on("error", (err) => {
        reject(
          new Error(
            `Failed to start FFmpeg process (${ffmpegBin}): ${err.message}. Deployment blocker: FFmpeg is required for Instagram image composition.`
          )
        );
      });

      proc.on("close", (code) => {
        if (code === 0 && fs.existsSync(outputTempPath)) {
          resolve();
        } else {
          reject(
            new Error(
              `FFmpeg exited with error code ${code}: ${stderr.slice(-500)}`
            )
          );
        }
      });
    });

    // Read rendered image and upload to Vercel Blob
    const renderedBuffer = fs.readFileSync(outputTempPath);
    const filename = `rendered-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    const blobResult = await vercelBlobService.uploadTemporaryImage({
      fileBuffer: renderedBuffer,
      fileName: filename,
      declaredMimeType: "image/jpeg",
    });

    return {
      renderedBlobUrl: blobResult.url,
      renderedBlobPathname: blobResult.pathname,
      width: outputWidth,
      height: outputHeight,
      size: renderedBuffer.length,
      contentType: "image/jpeg",
    };
  } finally {
    // Clean up all temporary files safely
    for (const f of tempFilesToClean) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore cleanup error
      }
    }
  }
}
