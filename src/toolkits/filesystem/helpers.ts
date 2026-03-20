import { readFileSync } from "fs";
import fs from "fs/promises";
import path, { extname } from "path";
import ignore, { type Ignore } from "ignore";
import { applyPatch, type ApplyPatchOptions, type StructuredPatch } from "diff";
import {
  DEFAULT_IGNORE_PATTERNS,
  MAX_COMMAND_OUTPUT_CHARS,
  PATCH_NOISE_CHARS,
  PATCH_SPACE_LIKE_CHARS,
  PATCH_TRAILING_SPACES,
} from "./constants";

export function codeBlock(content: string, filepath?: string) {
  let block = `\`\`\`\n${content}\n\`\`\``;
  if (filepath) block = `${filepath}\n${block}`;
  return block;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)}M`;
  return `${(bytes / 1024 ** 3).toFixed(1)}G`;
}

export function loadGitignore(dir: string): Ignore | null {
  try {
    const raw = readFileSync(path.join(dir, ".gitignore"), "utf-8");
    return ignore().add(raw);
  } catch {
    return null;
  }
}

export function guessImageMimeType(filepath: string) {
  const ext = extname(filepath).toLowerCase();

  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".bmp":
      return "image/bmp";
    case ".ico":
      return "image/x-icon";
    default:
      return `image/${ext.slice(1) || "png"}`;
  }
}

export function hasUtf8Bom(buffer: Buffer) {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  );
}

export function decodeTextFile(buffer: Buffer) {
  const withBom = hasUtf8Bom(buffer);
  return {
    hasBom: withBom,
    content: buffer.subarray(withBom ? 3 : 0).toString("utf-8"),
  };
}

export function normalizeComparablePatchLine(value: string) {
  const normalized = value
    .replace(/^\uFEFF/, "")
    .replace(/\r+$/g, "")
    .replace(PATCH_NOISE_CHARS, "")
    .replace(PATCH_SPACE_LIKE_CHARS, " ");

  if (/^[ \t]*$/.test(normalized)) return "";
  return normalized.replace(PATCH_TRAILING_SPACES, "");
}

export function comparePatchedLine(
  _lineNumber: number,
  line: string,
  _operation: string,
  patchContent: string,
) {
  return (
    line === patchContent ||
    normalizeComparablePatchLine(line) ===
      normalizeComparablePatchLine(patchContent)
  );
}

export function normalizePatchPath(filepath: string) {
  return filepath
    .replaceAll("\\", "/")
    .replace(/^"+|"+$/g, "")
    .replace(/^(?:a|b)\//, "")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");
}

export function scorePatchTarget(target: string, candidate: string) {
  const normalizedTarget = normalizePatchPath(target);
  const normalizedCandidate = normalizePatchPath(candidate);

  if (
    !normalizedTarget ||
    !normalizedCandidate ||
    normalizedTarget === "/dev/null"
  ) {
    return 0;
  }

  if (normalizedTarget === normalizedCandidate) return 3;

  if (
    normalizedTarget.endsWith(`/${normalizedCandidate}`) ||
    normalizedCandidate.endsWith(`/${normalizedTarget}`)
  ) {
    return 2;
  }

  if (
    path.posix.basename(normalizedTarget) ===
    path.posix.basename(normalizedCandidate)
  ) {
    return 1;
  }

  return 0;
}

export function describePatchTarget(patch: StructuredPatch) {
  return (
    patch.newFileName || patch.oldFileName || patch.index || "(unknown target)"
  );
}

export function pickPatchForFile(
  patches: StructuredPatch[],
  cwd: string,
  filepath: string,
  resolved: string,
) {
  if (patches.length === 1) return patches[0] ?? null;

  const candidates = [
    filepath,
    resolved,
    path.relative(cwd, resolved),
    path.basename(resolved),
  ].filter(Boolean);

  const scored = patches
    .map((patch) => {
      const targets = [
        patch.oldFileName,
        patch.newFileName,
        patch.index,
      ].filter((value): value is string => Boolean(value));

      const score = targets.reduce((best, target) => {
        return Math.max(
          best,
          ...candidates.map((candidate) => scorePatchTarget(target, candidate)),
        );
      }, 0);

      return { patch, score };
    })
    .filter((entry) => entry.score > 0);

  if (scored.length === 0) return null;

  const bestScore = Math.max(...scored.map((entry) => entry.score));
  const bestMatches = scored.filter((entry) => entry.score === bestScore);

  if (bestMatches.length === 1) return bestMatches[0]?.patch ?? null;
  return null;
}

export function normalizeUnifiedPatch(patch: string) {
  const normalized = patch.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  while (lines[0] === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  if (
    lines.length >= 2 &&
    /^```(?:diff|patch)?$/i.test(lines[0]?.trim() ?? "") &&
    (lines[lines.length - 1]?.trim() ?? "") === "```"
  ) {
    return lines.slice(1, -1).join("\n");
  }

  return lines.join("\n");
}

export function tryApplyPatchWithFallbacks(
  source: string,
  patch: StructuredPatch,
) {
  const attempts: Array<{ label: string; options: ApplyPatchOptions }> = [
    {
      label: "strict",
      options: { autoConvertLineEndings: true },
    },
    {
      label: "normalized-whitespace",
      options: {
        autoConvertLineEndings: true,
        compareLine: comparePatchedLine,
      },
    },
    {
      label: "normalized-whitespace+fuzz",
      options: {
        autoConvertLineEndings: true,
        compareLine: comparePatchedLine,
        fuzzFactor: 1,
      },
    },
  ];

  for (const attempt of attempts) {
    const result = applyPatch(source, patch, attempt.options);
    if (result !== false) {
      return {
        content: result,
        strategy: attempt.label,
      };
    }
  }

  return null;
}

export function normalizeCommandOutput(
  value: string | Buffer | null | undefined,
) {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf-8");
  return "";
}

export function truncateCommandOutput(
  value: string,
  limit = MAX_COMMAND_OUTPUT_CHARS,
) {
  if (value.length <= limit) {
    return { content: value, truncated: false };
  }

  return {
    content: value.slice(0, limit),
    truncated: true,
  };
}

export function formatCommandOutput(
  label: string,
  value: string,
  truncated: boolean,
) {
  const suffix = truncated ? " (truncated)" : "";

  if (!value) return `${label}${suffix}: [empty]`;

  return `${label}${suffix}:\n\`\`\`\n${value}\`\`\``;
}

export function formatCommandResult(result: {
  ok: boolean;
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode?: number | string | null;
  signal?: NodeJS.Signals | null;
  timedOut?: boolean;
  errorMessage?: string;
}) {
  const stdout = truncateCommandOutput(result.stdout);
  const stderr = truncateCommandOutput(result.stderr);
  const lines = [
    result.ok
      ? `Command completed successfully: ${result.command}`
      : result.timedOut
        ? `Command timed out: ${result.command}`
        : `Command failed: ${result.command}`,
    `CWD: ${result.cwd}`,
  ];

  if (result.exitCode !== undefined && result.exitCode !== null)
    lines.push(`Exit code: ${result.exitCode}`);
  if (result.signal) lines.push(`Signal: ${result.signal}`);
  if (result.errorMessage) lines.push(`Error: ${result.errorMessage}`);
  lines.push(formatCommandOutput("stdout", stdout.content, stdout.truncated));
  lines.push(formatCommandOutput("stderr", stderr.content, stderr.truncated));
  return lines.join("\n");
}

export async function lstatIfExists(target: string) {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw error;
  }
}

export function defaultBuiltinIgnorePatterns() {
  return [...DEFAULT_IGNORE_PATTERNS];
}
