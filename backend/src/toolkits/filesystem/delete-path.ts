import fs from "fs/promises";
import path from "path";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { DeletePathInputSchema, type DeletePathOptions } from "./schemas";
import { stringifyError } from "../../utils/errors";

export function createDeletePathTool(context: FilesystemContext): ToolkitTool {
  async function deletePath(target: string, options?: DeletePathOptions) {
    const trimmed = target.trim();
    if (!trimmed) return "Path cannot be empty.";

    try {
      const resolved = context.resolveUserPath(target);
      const root = path.parse(resolved).root;

      if (resolved === root) {
        return `Refusing to delete filesystem root: ${resolved}`;
      }

      if (resolved === context.normalizedCwd) {
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
    name: "deletePath",
    description: "刪除文件/文件夾",
    schema: DeletePathInputSchema,
    invoke: async (input) => {
      const { target, options } = DeletePathInputSchema.parse(input);
      return deletePath(target, options);
    },
  };
}
