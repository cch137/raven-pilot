import { readFileSync } from "fs";
import fs from "fs/promises";
import path, { extname } from "path";
import ignore, { type Ignore } from "ignore";
import {
  DEFAULT_IGNORE_PATTERNS,
  MAX_COMMAND_OUTPUT_CHARS,
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
