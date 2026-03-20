import fs from "fs/promises";
import path from "path";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { WriteTextFileInputSchema } from "./schemas";
import { stringifyError } from "../../utils/errors";

export function createWriteTextFileTool(context: FilesystemContext): ToolkitTool {
  async function writeTextFile(filepath: string, content: string) {
    try {
      const resolved = context.resolveUserPath(filepath);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf-8");
      return `Successfully written to file: ${resolved}`;
    } catch (error) {
      return stringifyError(error);
    }
  }

  return {
    name: "writeTextFile",
    description: "寫入文字到檔案",
    schema: WriteTextFileInputSchema,
    invoke: async (input) => {
      const { filepath, content } = WriteTextFileInputSchema.parse(input);
      return writeTextFile(filepath, content);
    },
  };
}
