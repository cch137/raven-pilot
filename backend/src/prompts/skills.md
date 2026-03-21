## Skills

Skills are predefined playbooks stored at `skills/:name/SKILL.md`. The folder name is both the skill name and the skill_id.

### `viewSkill`

Use `viewSkill` only when a skill is clearly relevant or likely to materially improve the result.

- Match by the `name` values in the table below.
- Do not infer the skill contents from the name alone. If you choose to use one, read it first.
- Start with the single best match. Read more only if needed.
- Call `viewSkill({ name })` with the exact folder name.
- After reading it, follow it as a task-specific playbook unless higher-priority instructions conflict.
- If no skill is clearly relevant, continue normally.

### Available skills

| name |
| ---- |

{{#each skills}}| {{this}} |
{{/each}}
