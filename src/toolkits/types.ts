import { z } from "zod";

export type ToolkitTool = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  invoke: (input: unknown) => Promise<unknown>;
};

export type ImagePart = {
  type: "image";
  base64: string;
  url: string;
  mimeType: string;
};

export type FilesystemContext = {
  normalizedCwd: string;
  resolveUserPath: (target: string) => string;
  images: Map<string, ImagePart>;
  nextImageIndex: () => number;
};

export type ToolkitModule = {
  tools: ToolkitTool[];
  getImagePart?: (id: string) => ImagePart | null;
};

export type Toolkit = {
  cwd: string;
  tools: ToolkitTool[];
  getImagePart: (id: string) => ImagePart | null;
};
