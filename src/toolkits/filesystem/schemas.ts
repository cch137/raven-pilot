import { z } from "zod";

export const DirTreeOptionsSchema = z.object({
  depth: z.number().optional().describe("Traversal depth. Default: 5"),
  max: z.number().optional().describe("Max items per directory. Default: 10"),
  size: z.boolean().optional().describe("Show file sizes. Default: true"),
  ignore: z
    .boolean()
    .optional()
    .describe("Respect .gitignore files. Default: true"),
  ignorePatterns: z
    .array(z.string())
    .optional()
    .describe(
      'Always-excluded patterns. Default: [".git",".hg",".svn"]. Pass [] to disable.',
    ),
});

export const DirTreeInputSchema = z.object({
  dirname: z.string(),
  options: DirTreeOptionsSchema.optional(),
});

export const ReadTextFilesInputSchema = z.object({
  filepaths: z.array(z.string()),
  showLineNumbers: z
    .boolean()
    .optional()
    .describe("Include a numberedContent view for each file. Default: false"),
});

export const ReadImageFileInputSchema = z.object({
  filepath: z.string(),
});

export const WriteTextFileInputSchema = z.object({
  filepath: z.string(),
  content: z.string(),
});

export const StringReplaceInputSchema = z.object({
  filepath: z.string(),
  oldString: z
    .string()
    .describe("Exact string to find in the target file"),
  newString: z
    .string()
    .describe("Replacement text for each matched string"),
  replaceAll: z
    .boolean()
    .optional()
    .describe("Replace every exact match. Default: false"),
});

export const CommandInputSchema = z.object({
  command: z.string(),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(300_000)
    .optional()
    .describe("Timeout in milliseconds. Default: 30000, max: 300000"),
});

export const DeletePathOptionsSchema = z.object({
  recursive: z
    .boolean()
    .optional()
    .describe("Recursively delete non-empty directories. Default: false"),
});

export const DeletePathInputSchema = z.object({
  target: z.string(),
  options: DeletePathOptionsSchema.optional(),
});

export const MovePathOptionsSchema = z.object({
  overwrite: z
    .boolean()
    .optional()
    .describe("Overwrite destination if it already exists. Default: false"),
});

export const MovePathInputSchema = z.object({
  source: z.string(),
  destination: z.string(),
  options: MovePathOptionsSchema.optional(),
});

export type DirTreeOptions = z.infer<typeof DirTreeOptionsSchema>;
export type DeletePathOptions = z.infer<typeof DeletePathOptionsSchema>;
export type MovePathOptions = z.infer<typeof MovePathOptionsSchema>;
