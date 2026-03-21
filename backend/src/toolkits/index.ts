import { normalizeDirectoryPath } from "../utils/paths";
import { createFilesystemToolkit } from "./filesystem/index";
import { createSkillsToolkit } from "./skills/index";
import type { ImagePart, Toolkit, ToolkitModule } from "./types";

export { createFilesystemToolkit } from "./filesystem/index";
export {
  buildSkillsSystemPromptSection,
  createSkillsToolkit,
} from "./skills/index";
export type { ImagePart, Toolkit, ToolkitModule, ToolkitTool } from "./types";

export function createToolkit(cwd: string): Toolkit {
  const normalizedCwd = normalizeDirectoryPath(cwd);
  const modules: ToolkitModule[] = [
    createFilesystemToolkit(normalizedCwd),
    createSkillsToolkit(),
  ];

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
