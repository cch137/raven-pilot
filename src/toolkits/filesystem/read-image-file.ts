import fs from "fs/promises";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { READ_IMAGE_PREFIX } from "./constants";
import { ReadImageFileInputSchema } from "./schemas";
import { guessImageMimeType } from "./helpers";
import { stringifyError } from "../../utils/errors";

export function createReadImageFileTool(context: FilesystemContext): ToolkitTool {
  async function readImageFile(filepath: string) {
    try {
      const resolved = context.resolveUserPath(filepath);
      const mimeType = guessImageMimeType(resolved);
      const content = await fs.readFile(resolved);
      const base64 = Buffer.from(new Uint8Array(content)).toString("base64");
      const imageId = `${READ_IMAGE_PREFIX}${context.nextImageIndex()}`;
      context.images.set(imageId, {
        type: "image",
        base64,
        url: `data:${mimeType};base64,${base64}`,
        mimeType,
      });
      return imageId;
    } catch (error) {
      return stringifyError(error);
    }
  }

  return {
    name: "readImageFile",
    description: "批量讀取圖片檔案",
    schema: ReadImageFileInputSchema,
    invoke: async (input) => {
      const { filepath } = ReadImageFileInputSchema.parse(input);
      return readImageFile(filepath);
    },
  };
}
