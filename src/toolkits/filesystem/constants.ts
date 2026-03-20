export const READ_IMAGE_PREFIX = "read_image:";
export const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
export const MAX_COMMAND_BUFFER_BYTES = 4 * 1024 * 1024;
export const MAX_COMMAND_OUTPUT_CHARS = 20_000;
export const DEFAULT_IGNORE_PATTERNS = [".git", ".hg", ".svn"] as const;
export const PATCH_NOISE_CHARS = /[\u0000\u200B\u200C\u200D\u2060]/g;
export const PATCH_SPACE_LIKE_CHARS = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
export const PATCH_TRAILING_SPACES =
  /[ \t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+$/g;
