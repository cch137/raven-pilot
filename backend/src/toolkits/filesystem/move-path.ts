import fs from "fs/promises";
import path from "path";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { MovePathInputSchema, type MovePathOptions } from "./schemas";
import { lstatIfExists } from "./helpers";
import { stringifyError } from "../../utils/errors";

export function createMovePathTool(context: FilesystemContext): ToolkitTool {
  async function movePath(
    source: string,
    destination: string,
    options?: MovePathOptions,
  ) {
    const trimmedSource = source.trim();
    const trimmedDestination = destination.trim();

    if (!trimmedSource) return "Source path cannot be empty.";
    if (!trimmedDestination) return "Destination path cannot be empty.";

    try {
      const resolvedSource = context.resolveUserPath(source);
      const resolvedDestination = context.resolveUserPath(destination);
      const sourceRoot = path.parse(resolvedSource).root;
      const destinationRoot = path.parse(resolvedDestination).root;

      if (resolvedSource === sourceRoot) {
        return `Refusing to move filesystem root: ${resolvedSource}`;
      }

      if (resolvedSource === context.normalizedCwd) {
        return `Refusing to move current working directory: ${resolvedSource}`;
      }

      if (resolvedDestination === destinationRoot) {
        return `Refusing to overwrite filesystem root: ${resolvedDestination}`;
      }

      if (resolvedDestination === context.normalizedCwd) {
        return `Refusing to overwrite current working directory: ${resolvedDestination}`;
      }

      if (resolvedSource === resolvedDestination) {
        return `Source and destination are the same: ${resolvedSource}`;
      }

      const sourceStat = await fs.lstat(resolvedSource);

      if (sourceStat.isDirectory()) {
        const relativeDestination = path.relative(
          resolvedSource,
          resolvedDestination,
        );

        if (
          relativeDestination &&
          !relativeDestination.startsWith("..") &&
          !path.isAbsolute(relativeDestination)
        ) {
          return `Refusing to move a directory into itself: ${resolvedSource} -> ${resolvedDestination}`;
        }
      }

      const overwrite = options?.overwrite ?? false;
      const destinationStat = await lstatIfExists(resolvedDestination);

      if (destinationStat) {
        if (!overwrite) {
          return `Destination already exists: ${resolvedDestination}`;
        }

        if (destinationStat.isDirectory() !== sourceStat.isDirectory()) {
          return `Cannot overwrite ${destinationStat.isDirectory() ? "directory" : "file"} with ${sourceStat.isDirectory() ? "directory" : "file"}: ${resolvedDestination}`;
        }

        await fs.rm(resolvedDestination, {
          recursive: destinationStat.isDirectory(),
          force: false,
        });
      }

      await fs.mkdir(path.dirname(resolvedDestination), { recursive: true });

      try {
        await fs.rename(resolvedSource, resolvedDestination);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== "EXDEV") {
          throw error;
        }

        await fs.cp(resolvedSource, resolvedDestination, {
          recursive: sourceStat.isDirectory(),
          force: false,
          errorOnExist: true,
        });

        await fs.rm(resolvedSource, {
          recursive: sourceStat.isDirectory(),
          force: false,
        });
      }

      return `Successfully moved ${sourceStat.isDirectory() ? "directory" : "file"}: ${resolvedSource} -> ${resolvedDestination}`;
    } catch (error) {
      return stringifyError(error);
    }
  }

  return {
    name: "movePath",
    description: "移動文件/文件夾",
    schema: MovePathInputSchema,
    invoke: async (input) => {
      const { source, destination, options } = MovePathInputSchema.parse(input);
      return movePath(source, destination, options);
    },
  };
}
