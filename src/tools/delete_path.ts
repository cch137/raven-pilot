import path from "path";
import fs from "fs/promises";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { stringifyError } from "./utils.js";

const DeletePathOptionsSchema = z.object({
  recursive: z
    .boolean()
    .optional()
    .describe("Recursively delete non-empty directories. Default: false"),
});

async function deletePath(target: string, options?: z.infer<typeof DeletePathOptionsSchema>) {
  const trimmed = target.trim();
  if (!trimmed) return "Path cannot be empty.";

  try {
    const resolved = path.resolve(trimmed);
    const cwd = process.cwd();
    const root = path.parse(resolved).root;

    if (resolved === root) {
      return `Refusing to delete filesystem root: ${resolved}`;
    }

    if (resolved === cwd) {
      return `Refusing to delete current working directory: ${resolved}`;
    }

    const stat = await fs.lstat(resolved);
    const recursive = options?.recursive ?? false;

    if (stat.isDirectory()) {
      await fs.rm(resolved, { recursive, force: false });
      return `Successfully deleted directory: ${target}`;
    }

    await fs.rm(resolved, { force: false });
    return `Successfully deleted file: ${target}`;
  } catch (error) {
    return stringifyError(error);
  }
}

export const deletePathTool = tool(
  async ({ target, options }) => {
    return await deletePath(target, options);
  },
  {
    name: "deletePath",
    description: "刪除文件/文件夾",
    schema: z.object({
      target: z.string(),
      options: DeletePathOptionsSchema.optional(),
    }),
  },
);
