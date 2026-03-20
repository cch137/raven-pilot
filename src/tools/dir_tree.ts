import { readdirSync, readFileSync, statSync, realpathSync, Dirent } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import ignore, { Ignore } from "ignore";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

export const DEFAULT_IGNORE_PATTERNS = [".git", ".hg", ".svn"] as const;

export const DirTreeOptionsSchema = z.object({
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

export type DirTreeOptions = z.infer<typeof DirTreeOptionsSchema>;

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

export function dirTree(dirname: string, options?: DirTreeOptions): string {
  const maxDepth = options?.depth ?? 5;
  const maxItems = options?.max ?? 10;
  const showSize = options?.size ?? true;
  const useGitignore = options?.ignore ?? true;
  const builtinIgnore = options?.ignorePatterns ?? [...DEFAULT_IGNORE_PATTERNS];

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

    entries = entries.filter((e) => {
      const rel = e.isDirectory() ? `${e.name}/` : e.name;
      if (builtinMatcher?.ignores(e.name) || builtinMatcher?.ignores(rel))
        return false;
      if (ig && e.name !== ".gitignore" && ig.ignores(rel)) return false;
      return true;
    });

    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const visible = entries.slice(0, maxItems);
    const remaining = entries.length - visible.length;
    const lines: string[] = [];

    for (let i = 0; i < visible.length; i++) {
      const entry = visible[i];
      const isLast = i === visible.length - 1 && remaining === 0;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? `${prefix}    ` : `${prefix}│   `;

      if (entry.isDirectory()) {
        lines.push(`${prefix}${connector}${entry.name}/`);

        const childDir = path.join(dir, entry.name);
        if (currentDepth === maxDepth) {
          let hasChildren = false;
          try {
            const childEntries = readdirSync(childDir);
            hasChildren = childEntries.length > 0;
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

  const resolved = realpathSync(dirname);
  const rootName = path.basename(resolved);

  const treeLines: string[] = [`${rootName}/`];
  treeLines.push(...walk(resolved, 1, "", null));

  return treeLines.join("\n");
}

// ---- CLI entry point ----
// Usage: npx ts-node dirTree.ts [path] [depth] [max] [size] [ignore]
const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const [, , target = ".", rawDepth, rawMax, rawSize, rawIgnore] = process.argv;

  const depth = rawDepth ? parseInt(rawDepth) : 5;
  const max = rawMax ? parseInt(rawMax) : 10;
  const size = rawSize !== "false";
  const useIgn = rawIgnore !== "false";

  console.log(dirTree(target, { depth, max, size, ignore: useIgn }));
}

export const dirTreeTool = tool(
  ({ dirname, options }) => {
    return dirTree(dirname, options);
  },
  {
    name: "dirTree",
    description: "讀取資料夾結構",
    schema: z.object({
      dirname: z.string(),
      options: DirTreeOptionsSchema.optional(),
    }),
  },
);
