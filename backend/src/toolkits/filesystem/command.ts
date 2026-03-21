import { exec } from "child_process";
import { promisify } from "util";
import type { ToolkitTool } from "../types";
import type { FilesystemContext } from "../types";
import { CommandInputSchema } from "./schemas";
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  MAX_COMMAND_BUFFER_BYTES,
} from "./constants";
import { formatCommandResult, normalizeCommandOutput } from "./helpers";
import { stringifyError } from "../../utils/errors";

const execAsync = promisify(exec);

export function createCommandTool(context: FilesystemContext): ToolkitTool {
  async function command(
    commandText: string,
    timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  ) {
    const trimmed = commandText.trim();
    if (!trimmed) return "Command cannot be empty.";

    try {
      const { stdout, stderr } = await execAsync(trimmed, {
        cwd: context.normalizedCwd,
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: MAX_COMMAND_BUFFER_BYTES,
      });

      return formatCommandResult({
        ok: true,
        command: trimmed,
        cwd: context.normalizedCwd,
        stdout: normalizeCommandOutput(stdout),
        stderr: normalizeCommandOutput(stderr),
        exitCode: 0,
      });
    } catch (error) {
      const commandError = error as NodeJS.ErrnoException & {
        stdout?: string | Buffer;
        stderr?: string | Buffer;
        code?: number | string | null;
        signal?: NodeJS.Signals | null;
        killed?: boolean;
      };

      const errorMessage =
        commandError.killed || typeof commandError.code === "string"
          ? stringifyError(error)
          : undefined;

      return formatCommandResult({
        ok: false,
        command: trimmed,
        cwd: context.normalizedCwd,
        stdout: normalizeCommandOutput(commandError.stdout),
        stderr: normalizeCommandOutput(commandError.stderr),
        exitCode: commandError.code,
        signal: commandError.signal,
        timedOut: commandError.killed,
        errorMessage,
      });
    }
  }

  return {
    name: "command",
    description: "在目前工作目錄執行 shell 指令",
    schema: CommandInputSchema,
    invoke: async (input) => {
      const { command: commandText, timeoutMs } =
        CommandInputSchema.parse(input);
      return command(commandText, timeoutMs);
    },
  };
}
