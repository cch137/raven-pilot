import type { Dirent } from "fs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import { z } from "zod";
import { stringifyError } from "../../utils/errors";
import type { ToolkitModule } from "../types";

const SKILLS_DIR = fileURLToPath(new URL("../../skills/", import.meta.url));
const SKILLS_PROMPT_FILEPATH = fileURLToPath(
  new URL("../../prompts/skills.md", import.meta.url),
);
type SkillRecord = {
  name: string;
  filepath: string;
};

const ViewSkillInputSchema = z.object({
  name: z.string().describe("Exact skill name (folder name) to read."),
});

let skillCatalogPromise: Promise<SkillRecord[]> | null = null;
let skillsPromptTemplatePromise: Promise<Handlebars.TemplateDelegate> | null =
  null;

function codeBlock(content: string, filepath?: string) {
  let block = `\`\`\`\n${content}\n\`\`\``;
  if (filepath) block = `${filepath}\n${block}`;
  return block;
}

function escapeMarkdownTableCell(value: string) {
  return value.trim().replace(/\|/g, "\\|").replace(/\r?\n/g, "<br/>");
}

async function getSkillsPromptTemplate() {
  if (!skillsPromptTemplatePromise) {
    skillsPromptTemplatePromise = fs
      .readFile(SKILLS_PROMPT_FILEPATH, "utf-8")
      .then((content) =>
        Handlebars.compile(content.trim(), { noEscape: true }),
      );
  }

  return skillsPromptTemplatePromise;
}

function createSkillRecord(name: string): SkillRecord {
  return {
    name,
    filepath: path.join(SKILLS_DIR, name, "SKILL.md"),
  };
}

export async function getSkillCatalog(): Promise<SkillRecord[]> {
  if (!skillCatalogPromise) {
    skillCatalogPromise = (async () => {
      let entries: Dirent[] = [];

      try {
        entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return [];
        throw error;
      }

      const skills = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => createSkillRecord(entry.name));

      return skills.sort((left, right) => left.name.localeCompare(right.name));
    })();
  }

  return skillCatalogPromise;
}

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase();
}

async function findSkillByName(name: string) {
  const lookup = normalizeLookupValue(name);
  const skills = await getSkillCatalog();

  return (
    skills.find((skill) => normalizeLookupValue(skill.name) === lookup) ?? null
  );
}

export async function buildSkillsSystemPromptSection() {
  const [template, catalog] = await Promise.all([
    getSkillsPromptTemplate(),
    getSkillCatalog(),
  ]);
  const skills = catalog.length
    ? catalog.map((skill) => escapeMarkdownTableCell(skill.name))
    : ["—"];

  return template({ skills });
}

export function createSkillsToolkit(): ToolkitModule {
  return {
    tools: [
      {
        name: "viewSkill",
        description:
          "Read skills/:name/SKILL.md for a specific skill. Use the exact folder name.",
        schema: ViewSkillInputSchema,
        invoke: async (input) => {
          const { name } = ViewSkillInputSchema.parse(input);

          try {
            const skill = await findSkillByName(name);

            if (!skill) {
              const skills = await getSkillCatalog();
              const available = skills.map((entry) => entry.name).join(", ");

              return available
                ? `Skill not found: ${name}. Available skills: ${available}`
                : `Skill not found: ${name}. No skills are currently available.`;
            }

            const raw = await fs.readFile(skill.filepath, "utf-8");
            const displayPath = path.posix.join(
              "skills",
              skill.name,
              "SKILL.md",
            );
            return raw;
          } catch (error) {
            return stringifyError(error);
          }
        },
      },
    ],
  };
}
