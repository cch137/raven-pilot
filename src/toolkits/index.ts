import fs from "fs/promises";
import {
  Dirent,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "fs";
import path, { extname } from "path";
import ignore, { Ignore } from "ignore";
import { applyPatch } from "diff";
import { z } from "zod";
import { stringifyError } from "../utils/errors";
import {
  normalizeDirectoryPath,
  resolvePathFromBase,
} from "../utils/paths";

export type ToolkitTool = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  invoke: (input: unknown) => Promise<unknown>;
};

type ImagePart = {
  type: "image";
  base64: string;
  url: string;
  mimeType: string;
};

export type Toolkit = {
  cwd: string;
  tools: ToolkitTool[];
  getImagePart: (id: string) => ImagePart | null;
};

const READ_IMAGE_PREFIX = "read_image:";
const DEFAULT_IGNORE_PATTERNS = [".git", ".hg", ".svn"] as const;

const DirTreeOptionsSchema = z.object({
  depth: z.number().optional().describe("Traversal depth. Default: 5"),
  max: z.number().optional().describe("Max items per directory. Default: 10"),
  size: z.boolean().optional().describe("Show file sizes. Default: true"),
  ignore: z
    .boolean()
    .optional()
    .describe("Respect .gitignore files. Default: true"),
  ignorePatterns: z
    .array(z.string())
    .optional()
    .describe(
      'Always-excluded patterns. Default: [".git",".hg",".svn"]. Pass [] to disable.',
    ),
});

const DirTreeInputSchema = z.object({
  dirname: z.string(),
  options: DirTreeOptionsSchema.optional(),
});

const ReadTextFilesInputSchema = z.object({
  filepaths: z.array(z.string()),
});

const ReadImageFileInputSchema = z.object({
  filepath: z.string(),
});

const WriteTextFileInputSchema = z.object({
  filepath: z.string(),
  content: z.string(),
});

const PatchTextFileInputSchema = z.object({
  filepath: z.string(),
  patch: z.string(),
});

const DeletePathOptionsSchema = z.object({
  recursive: z
    .boolean()
    .optional()
    .describe("Recursively delete non-empty directories. Default: false"),
});

const DeletePathInputSchema = z.object({
  target: z.string(),
  options: DeletePathOptionsSchema.optional(),
});

type DirTreeOptions = z.infer<typeof DirTreeOptionsSchema>;
type DeletePathOptions = z.infer<typeof DeletePathOptionsSchema>;

function codeBlock(content: string, filepath?: string) {
  let block = `\`\`\`\n${content}\`\`\``;
  if (filepath) block = `${filepath}\n${block}`;
  return block;
}

function formatDisplayPath(input: string, resolved: string) {
  return input.trim() === resolved ? resolved : `${input} -> ${resolved}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)}M`;
  return `${(bytes / 1024 ** 3).toFixed(1)}G`;
}

function loadGitignore(dir: string): Ignore | null {
  try {
    const raw = readFileSync(path.join(dir, ".gitignore"), "utf-8");
    return ignore().add(raw);
  } catch {
    return null;
  }
}

function guessImageMimeType(filepath: string) {
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

export function createToolkit(cwd: string): Toolkit {
  const normalizedCwd = normalizeDirectoryPath(cwd);
  let imageIndex = 0;
  const images = new Map<string, ImagePart>();

  const resolveUserPath = (target: string) =>
    resolvePathFromBase(normalizedCwd, target);

  function dirTree(dirname: string, options?: DirTreeOptions): string {
    try {
      const maxDepth = options?.depth ?? 5;
      const maxItems = options?.max ?? 10;
      const showSize = options?.size ?? true;
      const useGitignore = options?.ignore ?? true;
      const builtinIgnore =
        options?.ignorePatterns ?? [...DEFAULT_IGNORE_PATTERNS];

      const builtinMatcher: Ignore | null =
        builtinIgnore.length > 0 ? ignore().add(builtinIgnore) : null;

      function walk(
        dir: string,
        currentDepth: number,
        prefix: string,
        parentIg: Ignore | null,
      ): string[] {
        if (currentDepth > maxDepth) return [];

        let ig: Ignore | null = parentIg;
        if (useGitignore) {
          const local = loadGitignore(dir);
          if (local) {
            ig = parentIg ? ignore().add(parentIg).add(local) : local;
          }
        }

        let entries: Dirent[];
        try {
          entries = readdirSync(dir, { withFileTypes: true });
        } catch {
          return [`${prefix}[Permission denied]`];
        }

        entries = entries.filter((entry) => {
          const rel = entry.isDirectory() ? `${entry.name}/` : entry.name;
          if (
            builtinMatcher?.ignores(entry.name) ||
            builtinMatcher?.ignores(rel)
          ) {
            return false;
          }
          if (ig && entry.name !== ".gitignore" && ig.ignores(rel)) {
            return false;
          }
          return true;
        });

        entries.sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) {
            return a.isDirectory() ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        const visible = entries.slice(0, maxItems);
        const remaining = entries.length - visible.length;
        const lines: string[] = [];

        for (let index = 0; index < visible.length; index += 1) {
          const entry = visible[index];
          const isLast = index === visible.length - 1 && remaining === 0;
          const connector = isLast ? "└── " : "├── ";
          const childPrefix = isLast ? `${prefix}    ` : `${prefix}│   `;

          if (entry.isDirectory()) {
            lines.push(`${prefix}${connector}${entry.name}/`);

            const childDir = path.join(dir, entry.name);
            if (currentDepth === maxDepth) {
              let hasChildren = false;
              try {
                hasChildren = readdirSync(childDir).length > 0;
              } catch {
                /* ignore */
              }
              if (hasChildren) {
                lines.push(`${childPrefix}└── ... (depth limit reached)`);
              }
            } else {
              lines.push(...walk(childDir, currentDepth + 1, childPrefix, ig));
            }
          } else {
            let sizeLabel = "";
            if (showSize) {
              try {
                const stat = statSync(path.join(dir, entry.name));
                sizeLabel = ` (${formatSize(stat.size)})`;
              } catch {
                /* ignore */
              }
            }
            lines.push(`${prefix}${connector}${entry.name}${sizeLabel}`);
          }
        }

        if (remaining > 0) {
          lines.push(
            `${prefix}└── ... (${remaining} not shown, max limit reached)`,
          );
        }

        return lines;
      }

      const resolved = realpathSync(resolveUserPath(dirname));
      const rootName = path.basename(resolved) || resolved;
      const treeLines: string[] = [`${rootName}/`, ...walk(resolved, 1, "", null)];

      return treeLines.join("\n");
    } catch (error) {
      return stringifyError(error);
    }
  }

  async function readTextFiles(filepaths: string[]) {
    return (
      await Promise.all(
        filepaths.map(async (filepath) => {
          try {
            const resolved = resolveUserPath(filepath);
            const content = new TextDecoder().decode(await fs.readFile(resolved));
            return codeBlock(content, formatDisplayPath(filepath, resolved));
          } catch (error) {
            return codeBlock(stringifyError(error), filepath || undefined);
          }
        }),
      )
    ).join("\n\n");
  }

  async function readImageFile(filepath: string) {
    try {
      const resolved = resolveUserPath(filepath);
      const mimeType = guessImageMimeType(resolved);
      const content = await fs.readFile(resolved);
      const base64 = Buffer.from(new Uint8Array(content)).toString("base64");
      const imageId = `${READ_IMAGE_PREFIX}${++imageIndex}`;
      images.set(imageId, {
        type: "image",
        base64,
        url: `data:${mimeType};base64,${base64}`,
        mimeType,
      });
      return imageId;
    } catch (error) {
      return stringifyError(error);
    }
  }

  async function writeTextFile(filepath: string, content: string) {
    try {
      const resolved = resolveUserPath(filepath);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf-8");
      return `Successfully written to file: ${resolved}`;
    } catch (error) {
      return stringifyError(error);
    }
  }

  async function patchTextFile(filepath: string, patch: string) {
    try {
      const resolved = resolveUserPath(filepath);
      const originalContent = new TextDecoder().decode(
        await fs.readFile(resolved),
      );
      const patchedContent = applyPatch(originalContent, patch);
      if (!patchedContent) {
        return `Failed to patch file: ${resolved}. The patch may be invalid or the file may have changed.`;
      }
      await fs.writeFile(resolved, patchedContent, "utf-8");
      return `File patched successfully: ${resolved}`;
    } catch (error) {
      return stringifyError(error);
    }
  }

  async function deletePath(target: string, options?: DeletePathOptions) {
    const trimmed = target.trim();
    if (!trimmed) return "Path cannot be empty.";

    try {
      const resolved = resolveUserPath(target);
      const root = path.parse(resolved).root;

      if (resolved === root) {
        return `Refusing to delete filesystem root: ${resolved}`;
      }

      if (resolved === normalizedCwd) {
        return `Refusing to delete current working directory: ${resolved}`;
      }

      const stat = await fs.lstat(resolved);
      const recursive = options?.recursive ?? false;

      if (stat.isDirectory()) {
        await fs.rm(resolved, { recursive, force: false });
        return `Successfully deleted directory: ${resolved}`;
      }

      await fs.rm(resolved, { force: false });
      return `Successfully deleted file: ${resolved}`;
    } catch (error) {
      return stringifyError(error);
    }
  }

  return {
    cwd: normalizedCwd,
    tools: [
      {
        name: "dirTree",
        description: "讀取資料夾結構",
        schema: DirTreeInputSchema,
        invoke: async (input) => {
          const { dirname, options } = DirTreeInputSchema.parse(input);
          return dirTree(dirname, options);
        },
      },
      {
        name: "readTextFiles",
        description: "批量讀取文字檔案",
        schema: ReadTextFilesInputSchema,
        invoke: async (input) => {
          const { filepaths } = ReadTextFilesInputSchema.parse(input);
          return readTextFiles(filepaths);
        },
      },
      {
        name: "readImageFile",
        description: "批量讀取圖片檔案",
        schema: ReadImageFileInputSchema,
        invoke: async (input) => {
          const { filepath } = ReadImageFileInputSchema.parse(input);
          return readImageFile(filepath);
        },
      },
      {
        name: "writeTextFile",
        description: "寫入文字到檔案",
        schema: WriteTextFileInputSchema,
        invoke: async (input) => {
          const { filepath, content } = WriteTextFileInputSchema.parse(input);
          return writeTextFile(filepath, content);
        },
      },
      {
        name: "patchTextFile",
        description:
          "Apply a unified diff patch to an existing text file. The `patch` must be a valid unified diff string (as produced by `diff -u`), including --- / +++ headers and @@ hunk markers. Prefer this tool over a full file rewrite when only a few lines need to change. Returns a success message if the patch was applied, or an error message if the file has changed since the patch was generated or the patch is malformed.",
        schema: PatchTextFileInputSchema,
        invoke: async (input) => {
          const { filepath, patch } = PatchTextFileInputSchema.parse(input);
          return patchTextFile(filepath, patch);
        },
      },
      {
        name: "deletePath",
        description: "刪除文件/文件夾",
        schema: DeletePathInputSchema,
        invoke: async (input) => {
          const { target, options } = DeletePathInputSchema.parse(input);
          return deletePath(target, options);
        },
      },
    ],
    getImagePart(id: string) {
      if (!id.startsWith(READ_IMAGE_PREFIX)) return null;
      const part = images.get(id);
      if (part) images.delete(id);
      return part ?? null;
    },
  };
}
