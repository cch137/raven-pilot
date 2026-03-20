import fs from "fs/promises";
import { extname } from "path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { stringifyError } from "./utils";

export const READ_IMAGE_PREFIX = "read_image:";

type ImagePart = {
  type: "image";
  base64: string;
  url: string;
  mimeType: string;
};

let i = 0;
const images = new Map<string, ImagePart>();

async function readImageFile(filepath: string) {
  try {
    const mimeType = `image/${extname(filepath).slice(1).replace("jpg", "jpeg")}`;
    const content = await fs.readFile(filepath);
    const base64 = Buffer.from(new Uint8Array(content)).toString("base64");
    const imageId = `${READ_IMAGE_PREFIX}${++i}`;
    images.set(imageId, {
      type: "image",
      base64,
      url: `data:${mimeType};base64,${base64}`,
      mimeType,
    });
    return imageId;
  } catch (error) {
    console.error(error);
    return stringifyError(error);
  }
}

export function getImagePart(id: string) {
  if (!id.startsWith(READ_IMAGE_PREFIX)) return null;
  const part = images.get(id);
  if (part) images.delete(id);
  return part ?? null;
}

export const readImageFileTool = tool(
  async ({ filepath }) => {
    return await readImageFile(filepath);
  },
  {
    name: "readImageFile",
    description: "批量讀取圖片檔案",
    schema: z.object({
      filepath: z.string(),
    }),
  },
);
