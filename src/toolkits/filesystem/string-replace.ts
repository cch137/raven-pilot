import fs from "fs/promises";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { stringifyError } from "../../utils/errors";
import { decodeTextFile } from "./helpers";
import { StringReplaceInputSchema } from "./schemas";

function countOccurrences(content: string, search: string) {
  let count = 0;
  let start = 0;

  while (true) {
    const index = content.indexOf(search, start);
    if (index === -1) return count;
    count += 1;
    start = index + search.length;
  }
}

export function createStringReplaceTool(
  context: FilesystemContext,
): ToolkitTool {
  async function stringReplace(
    filepath: string,
    oldString: string,
    newString: string,
    replaceAll = false,
  ) {
    const trimmedPath = filepath.trim();
    if (!trimmedPath) return "File path cannot be empty.";
    if (!oldString) return "oldString cannot be empty.";

    try {
      const resolved = context.resolveUserPath(filepath);
      const originalFile = decodeTextFile(await fs.readFile(resolved));
      const matchCount = countOccurrences(originalFile.content, oldString);

      if (matchCount === 0) {
        return `Failed to replace string in file: ${resolved}. oldString was not found.`;
      }

      if (oldString === newString) {
        return `No changes made to file: ${resolved}. oldString and newString are identical.`;
      }

      if (!replaceAll && matchCount > 1) {
        return `Failed to replace string in file: ${resolved}. Found ${matchCount} matches for oldString. Provide a more specific oldString or set replaceAll to true.`;
      }

      const nextContent = replaceAll
        ? originalFile.content.split(oldString).join(newString)
        : originalFile.content.replace(oldString, newString);
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
      const { filepath, oldString, newString, replaceAll } =
        StringReplaceInputSchema.parse(input);
      return stringReplace(filepath, oldString, newString, replaceAll);
    },
  };
}
