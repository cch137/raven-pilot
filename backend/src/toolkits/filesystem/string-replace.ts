import fs from "fs/promises";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { stringifyError } from "../../utils/errors";
import { decodeTextFile } from "./helpers";
import { StringReplaceInputSchema } from "./schemas";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a regex from oldString where every whitespace run → \s+
 * This tolerates any mismatch in spaces, tabs, and line endings.
 */
function buildFuzzyPattern(oldString: string, replaceAll: boolean): RegExp {
  // Split on whitespace runs, escape each non-whitespace token, then join with \s+
  const parts = oldString.split(/\s+/);
  const pattern = parts.map(escapeRegExp).join("\\s+");
  return new RegExp(pattern, replaceAll ? "g" : "");
}

function countOccurrences(content: string, search: string): number {
  let count = 0;
  let start = 0;
  while (true) {
    const index = content.indexOf(search, start);
    if (index === -1) return count;
    count += 1;
    start = index + search.length;
  }
}

function countRegexMatches(content: string, pattern: RegExp): number {
  // Use a non-global copy of the pattern for counting
  const countPattern = new RegExp(pattern.source, "g");
  return (content.match(countPattern) ?? []).length;
}

export function createStringReplaceTool(
  context: FilesystemContext,
): ToolkitTool {
  async function stringReplace(
    filepath: string,
    oldString: string,
    newString: string,
    replaceAll = false,
    fuzzy = true,
  ) {
    const trimmedPath = filepath.trim();
    if (!trimmedPath) return "File path cannot be empty.";
    if (!oldString) return "oldString cannot be empty.";

    try {
      const resolved = context.resolveUserPath(filepath);
      const originalFile = decodeTextFile(await fs.readFile(resolved));
      const content = originalFile.content;

      let matchCount: number;
      let nextContent: string;

      if (fuzzy) {
        const pattern = buildFuzzyPattern(oldString, replaceAll);
        matchCount = countRegexMatches(content, pattern);

        if (matchCount === 0) {
          return `Failed to replace string in file: ${resolved}. oldString was not found (fuzzy mode).`;
        }

        // Check identical: run a single-match replace and compare
        const singlePattern = buildFuzzyPattern(oldString, false);
        const testReplaced = content.replace(singlePattern, newString);
        if (testReplaced === content && newString === content.match(singlePattern)?.[0]) {
          return `No changes made to file: ${resolved}. oldString and newString are identical.`;
        }

        if (!replaceAll && matchCount > 1) {
          return `Failed to replace string in file: ${resolved}. Found ${matchCount} fuzzy matches for oldString. Provide a more specific oldString or set replaceAll to true.`;
        }

        nextContent = replaceAll
          ? content.replace(buildFuzzyPattern(oldString, true), newString)
          : content.replace(singlePattern, newString);
      } else {
        matchCount = countOccurrences(content, oldString);

        if (matchCount === 0) {
          return `Failed to replace string in file: ${resolved}. oldString was not found.`;
        }

        if (oldString === newString) {
          return `No changes made to file: ${resolved}. oldString and newString are identical.`;
        }

        if (!replaceAll && matchCount > 1) {
          return `Failed to replace string in file: ${resolved}. Found ${matchCount} matches for oldString. Provide a more specific oldString or set replaceAll to true.`;
        }

        nextContent = replaceAll
          ? content.split(oldString).join(newString)
          : content.replace(oldString, newString);
      }

      const output = originalFile.hasBom ? `\uFEFF${nextContent}` : nextContent;
      await fs.writeFile(resolved, output, "utf-8");

      return `Replaced ${replaceAll ? matchCount : 1} occurrence${replaceAll ? "s" : ""} in file: ${resolved}`;
    } catch (error) {
      return stringifyError(error);
    }
  }

  return {
    name: "stringReplace",
    description:
      "Replace an exact string in an existing text file. By default this requires exactly one match. Set `replaceAll: true` to replace every exact match. Prefer this over rewriting the whole file for small localized edits.",
    schema: StringReplaceInputSchema,
    invoke: async (input) => {
      const { filepath, oldString, newString, replaceAll, fuzzy } =
        StringReplaceInputSchema.parse(input);
      return stringReplace(filepath, oldString, newString, replaceAll, fuzzy ?? true);
    },
  };
}
