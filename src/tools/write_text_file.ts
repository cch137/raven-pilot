import path from "path";
import fs from "fs/promises";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { stringifyError } from "./utils.js";

async function writeTextFile(filepath: string, content: string) {
  try {
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, content, "utf-8");
    return `Successfully written to file: ${filepath}`;
  } catch (error) {
    return stringifyError(error);
  }
}

export const writeTextFileTool = tool(
  async ({ filepath, content }) => {
    return await writeTextFile(filepath, content);
  },
  {
    name: "writeTextFile",
    description: "寫入文字到檔案",
    schema: z.object({ filepath: z.string(), content: z.string() }),
  },
);
