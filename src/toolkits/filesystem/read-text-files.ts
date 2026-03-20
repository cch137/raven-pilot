import fs from "fs/promises";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { ReadTextFilesInputSchema } from "./schemas";
import { stringifyError } from "../../utils/errors";

type ReadTextFileResult = {
  filepath: string;
  content?: string;
  numberedContent?: string;
  error?: string;
};

function formatNumberedContent(content: string) {
  const lines = content.split("\n");
  const lineNumberWidth = String(lines.length).length;

  return lines
    .map((line, index) => {
      return `${String(index + 1).padStart(lineNumberWidth, " ")} | ${line.replace(/\r$/, "")}`;
    })
    .join("\n");
}

export function createReadTextFilesTool(context: FilesystemContext): ToolkitTool {
  async function readTextFiles(filepaths: string[], showLineNumbers = false) {
    return {
      files: await Promise.all(
        filepaths.map(async (filepath): Promise<ReadTextFileResult> => {
          try {
            const resolved = context.resolveUserPath(filepath);
            const content = new TextDecoder().decode(await fs.readFile(resolved));

            return {
              filepath,
              content,
              ...(showLineNumbers
                ? { numberedContent: formatNumberedContent(content) }
                : {}),
            };
          } catch (error) {
            return {
              filepath,
              error: stringifyError(error),
            };
          }
        }),
      ),
    };
  }

  return {
    name: "readTextFiles",
    description: "批量讀取文字檔案，可選擇回傳帶行號的 numberedContent 視圖",
    schema: ReadTextFilesInputSchema,
    invoke: async (input) => {
      const { filepaths, showLineNumbers } = ReadTextFilesInputSchema.parse(input);
      return readTextFiles(filepaths, showLineNumbers);
    },
  };
}
