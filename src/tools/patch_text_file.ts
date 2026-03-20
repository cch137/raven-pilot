import fs from "fs/promises";
import { applyPatch } from "diff";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { stringifyError } from "./utils.js";

async function patchTextFile(filepath: string, patch: string) {
  try {
    const originalContent = new TextDecoder().decode(
      await fs.readFile(filepath),
    );
    const patchedContent = applyPatch(originalContent, patch);
    if (!patchedContent) {
      return `Failed to patch file: ${filepath}. The patch may be invalid or the file may have changed.`;
    }
    await fs.writeFile(filepath, patchedContent, "utf-8");
    return `File patched successfully: ${filepath}`;
  } catch (error) {
    return stringifyError(error);
  }
}

export const patchTextFileTool = tool(
  async ({ filepath, patch }) => {
    return await patchTextFile(filepath, patch);
  },
  {
    name: "patchTextFile",
    description: `Apply a unified diff patch to an existing text file. The \`patch\` must be a valid unified diff string (as produced by \`diff -u\`), including --- / +++ headers and @@ hunk markers. Prefer this tool over a full file rewrite when only a few lines need to change. Returns a success message if the patch was applied, or an error message if the file has changed since the patch was generated or the patch is malformed.`,
    schema: z.object({ filepath: z.string(), patch: z.string() }),
  },
);
