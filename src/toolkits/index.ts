import { normalizeDirectoryPath } from "../utils/paths";
import { createFilesystemToolkit } from "./filesystem/index";
import type { ImagePart, Toolkit, ToolkitModule, ToolkitTool } from "./types";

export { createFilesystemToolkit } from "./filesystem/index";
export type { ImagePart, Toolkit, ToolkitModule, ToolkitTool } from "./types";

export function createToolkit(cwd: string): Toolkit {
  const normalizedCwd = normalizeDirectoryPath(cwd);
  const modules: ToolkitModule[] = [createFilesystemToolkit(normalizedCwd)];

  return {
    cwd: normalizedCwd,
    tools: modules.flatMap((module) => module.tools),
    getImagePart(id: string): ImagePart | null {
      for (const module of modules) {
        const part = module.getImagePart?.(id);
        if (part) return part;
      }

      return null;
    },
  };
}
