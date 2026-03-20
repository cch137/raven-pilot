import fs from "fs/promises";
import { parsePatch } from "diff";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { PatchTextFileInputSchema } from "./schemas";
import {
  describePatchTarget,
  decodeTextFile,
  normalizeUnifiedPatch,
  pickPatchForFile,
  tryApplyPatchWithFallbacks,
} from "./helpers";
import { stringifyError } from "../../utils/errors";

export function createPatchTextFileTool(context: FilesystemContext): ToolkitTool {
  async function patchTextFile(filepath: string, patch: string) {
    try {
      const resolved = context.resolveUserPath(filepath);
      const originalFile = decodeTextFile(await fs.readFile(resolved));
      const normalizedPatch = normalizeUnifiedPatch(patch);
      const parsedPatches = parsePatch(normalizedPatch);

      if (parsedPatches.length === 0) {
        return `Failed to patch file: ${resolved}. The patch did not contain any hunks.`;
      }

      const selectedPatch = pickPatchForFile(
        parsedPatches,
        context.normalizedCwd,
        filepath,
        resolved,
      );

      if (!selectedPatch) {
        if (parsedPatches.length === 1) {
          return `Failed to patch file: ${resolved}. The patch could not be resolved for this file.`;
        }

        const targets = parsedPatches
          .map((entry) => describePatchTarget(entry))
          .join(", ");

        return `Failed to patch file: ${resolved}. The patch targeted multiple files and none could be matched uniquely. Targets: ${targets}`;
      }

      if (selectedPatch.hunks.length === 0) {
        return `Failed to patch file: ${resolved}. The patch did not contain any hunks.`;
      }

      const patched = tryApplyPatchWithFallbacks(
        originalFile.content,
        selectedPatch,
      );

      if (!patched) {
        return `Failed to patch file: ${resolved}. The patch may be invalid, target the wrong file, or the file content may have changed.`;
      }

      const output = originalFile.hasBom
        ? `\uFEFF${patched.content}`
        : patched.content;

      await fs.writeFile(resolved, output, "utf-8");

      if (patched.strategy === "strict") {
        return `File patched successfully: ${resolved}`;
      }

      return `File patched successfully: ${resolved} (${patched.strategy})`;
    } catch (error) {
      return stringifyError(error);
    }
  }

  return {
    name: "patchTextFile",
    description:
      "Apply a unified diff patch to an existing text file. The `patch` must be a valid unified diff string (as produced by `diff -u`), including --- / +++ headers and @@ hunk markers. Prefer this tool over a full file rewrite when only a few lines need to change. Returns a success message if the patch was applied, or an error message if the file has changed since the patch was generated or the patch is malformed.",
    schema: PatchTextFileInputSchema,
    invoke: async (input) => {
      const { filepath, patch } = PatchTextFileInputSchema.parse(input);
      return patchTextFile(filepath, patch);
    },
  };
}
