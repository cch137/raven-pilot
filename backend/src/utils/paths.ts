import path from "path";

export function normalizeDirectoryPath(value: string) {
  const trimmed = value.trim();
  return path.resolve(trimmed || ".");
}

export function resolvePathFromBase(base: string, target: string) {
  const trimmed = target.trim();
  if (!trimmed) throw new Error("Path cannot be empty.");
  return path.resolve(base, trimmed);
}
