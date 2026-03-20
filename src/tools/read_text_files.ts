import fs from "fs/promises";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { stringifyError } from "./utils";

function codeBlock(content: string, filepath?: string) {
  content = "```\n" + content + "```";
  if (filepath) content = `${filepath}\n${content}`;
  return content;
}

async function readTextFiles(filepaths: string[]) {
  return (
    await Promise.all(
      filepaths.map(async (filepath) => {
        try {
          const content = new TextDecoder().decode(await fs.readFile(filepath));
          return codeBlock(content, filepath);
        } catch (error) {
          return codeBlock(stringifyError(error), filepath);
        }
      }),
    )
  ).join("\n\n");
}

export const readTextFilesTool = tool(
  async ({ filepaths }) => {
    return await readTextFiles(filepaths);
  },
  {
    name: "readTextFiles",
    description: "批量讀取文字檔案",
    schema: z.object({
      filepaths: z.array(z.string()),
    }),
  },
);
