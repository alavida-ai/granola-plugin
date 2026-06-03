---
"@alavida-ai/granola-plugin-openclaw": minor
---

Prefix every OpenClaw tool with the plugin id to avoid collisions in agent tool catalogues that load multiple plugins.

| Before          | After                  |
| --------------- | ---------------------- |
| `list_notes`    | `granola_list_notes`   |
| `read_note`     | `granola_read_note`    |
| `list_folders`  | `granola_list_folders` |

**Breaking** for any consumer (or saved agent prompt) that has hard-coded the old tool names. The agent reads the tool schema fresh on each call, so prompts that *reference* tools through the skill don't need updating — but any explicit `await agent.tool('list_notes', ...)` in user code does. Pre-1.0 → minor per changesets convention.

Updated together:

- `openclaw.plugin.json` — `contracts.tools` array now lists the prefixed names. OpenClaw uses this for cold-start routing.
- `src/tools/list-notes.ts`, `read-note.ts`, `list-folders.ts` — `name:` field on each `defineTool({…})` updated. Cross-references between tools (e.g. `read_note`'s description saying "Use after list_notes") updated too.
- `skills/granola/SKILL.md` — every reference in the worked examples, tips & tricks, and limitations sections updated. The 3-step drill-down headings now read `granola_list_folders` → `granola_list_notes` → `granola_read_note`.
- `src/pretty.ts` — comment markers updated for grep-ability; the renderer itself is shape-detected, not name-based, so behavior is unchanged.
