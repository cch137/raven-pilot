import { Dirent, readdirSync, realpathSync, statSync } from "fs";
import path from "path";
import ignore, { type Ignore } from "ignore";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { DirTreeInputSchema, type DirTreeOptions } from "./schemas";
import { DEFAULT_IGNORE_PATTERNS } from "./constants";
import { formatSize, loadGitignore } from "./helpers";
import { stringifyError } from "../../utils/errors";

export function createDirTreeTool(context: FilesystemContext): ToolkitTool {
  function dirTree(dirname: string, options?: DirTreeOptions): string {
    try {
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

      const resolved = realpathSync(context.resolveUserPath(dirname));
      const rootName = path.basename(resolved) || resolved;
      const treeLines: string[] = [
        `${rootName}/`,
        ...walk(resolved, 1, "", null),
      ];

      return treeLines.join("\n");
    } catch (error) {
      return stringifyError(error);
    }
  }

  return {
    name: "dirTree",
    description: "讀取資料夾結構",
    schema: DirTreeInputSchema,
    invoke: async (input) => {
      const { dirname, options } = DirTreeInputSchema.parse(input);
      return dirTree(dirname, options);
    },
  };
}
