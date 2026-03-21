import fs from "fs/promises";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { ReadTextFilesInputSchema } from "./schemas";
import { stringifyError } from "../../utils/errors";
import { codeBlock } from "./helpers";

function formatNumberedContent(content: string) {
  const lines = content.split("\n");
  const lineNumberWidth = String(lines.length).length;

  return lines
    .map((line, index) => {
      return `${String(index + 1).padStart(lineNumberWidth, " ")} | ${line.replace(/\r$/, "")}`;
    })
    .join("\n");
}

export function createReadTextFilesTool(
  context: FilesystemContext,
): ToolkitTool {
  async function readTextFiles(filepaths: string[], showLineNumbers = false) {
    return (
      await Promise.all(
        filepaths.map(async (filepath) => {
          try {
            const resolved = context.resolveUserPath(filepath);
            const content = new TextDecoder().decode(
              await fs.readFile(resolved),
            );
            return codeBlock(
              showLineNumbers ? formatNumberedContent(content) : content,
              filepath,
            );
          } catch (error) {
            return codeBlock(stringifyError(error), filepath);
          }
        }),
      )
    ).join("\n\n");
  }

  return {
    name: "readTextFiles",
    description: "批量讀取文字檔案，可選擇回傳帶行號的 numberedContent 視圖",
    schema: ReadTextFilesInputSchema,
    invoke: async (input) => {
      const { filepaths, showLineNumbers } =
        ReadTextFilesInputSchema.parse(input);
      return readTextFiles(filepaths, showLineNumbers);
    },
  };
}
