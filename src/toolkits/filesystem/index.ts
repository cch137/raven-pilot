import { normalizeDirectoryPath, resolvePathFromBase } from "../../utils/paths";
import type { ImagePart, ToolkitModule } from "../types";
import type { FilesystemContext } from "../types";
import { READ_IMAGE_PREFIX } from "./constants";
import { createCommandTool } from "./command";
import { createDeletePathTool } from "./delete-path";
import { createDirTreeTool } from "./dir-tree";
import { createMovePathTool } from "./move-path";
import { createReadImageFileTool } from "./read-image-file";
import { createReadTextFilesTool } from "./read-text-files";
import { createStringReplaceTool } from "./string-replace";
import { createWriteTextFileTool } from "./write-text-file";

export function createFilesystemToolkit(cwd: string): ToolkitModule {
  const normalizedCwd = normalizeDirectoryPath(cwd);
  let imageIndex = 0;
  const images = new Map<string, ImagePart>();

  const context: FilesystemContext = {
    normalizedCwd,
    resolveUserPath: (target: string) => resolvePathFromBase(normalizedCwd, target),
    images,
    nextImageIndex: () => ++imageIndex,
  };

  return {
    tools: [
      createDirTreeTool(context),
      createCommandTool(context),
      createReadTextFilesTool(context),
      createReadImageFileTool(context),
      createWriteTextFileTool(context),
      createStringReplaceTool(context),
      createMovePathTool(context),
      createDeletePathTool(context),
    ],
    getImagePart(id: string) {
      if (!id.startsWith(READ_IMAGE_PREFIX)) return null;
      const part = images.get(id);
      if (part) images.delete(id);
      return part ?? null;
    },
  };
}
