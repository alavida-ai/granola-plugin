# @alavida-ai/granola-plugin-openclaw

## 0.5.2

### Patch Changes

- 60b1961: Two fixes to the pretty rendering of list responses (`granola_list_notes`, `granola_list_folders`). Both improve how the default (`output: 'pretty'`) text payload looks to the agent — `output: 'json'` and the raw `details` payload are unchanged.

  ### Fix shape mismatch in `granola_list_notes` rendering

  Every note was displaying `<?>` for the owner and an empty date column. The renderer's `NoteShape` interface described the raw wire shape (nested `owner.email`, snake_case `created_at`) but the tool shapes the response into flat headlines (`ownerEmail`, `createdAt`) to make the payload smaller and easier to scan. The renderer read `n.owner?.email` against the flat shape, found nothing, and fell back to `?`.

  The two shapes never agreed — they were inconsistent from the original rewrite in PR #6. Nothing surfaced because the CLI uses its own renderer against the raw wire shape, and the OpenClaw tool wasn't exercised through a real agent until production. The TypeScript `as NoteShape` cast silenced the type system.

  Fix: split into two explicit interfaces — `NoteHeadline` (flat, for `granola_list_notes`) and `NoteDetail` (nested wire, for `granola_read_note`). `renderNoteList` reads `n.ownerEmail` / `n.createdAt`; `renderSingleNote` keeps reading `n.owner?.email` / `n.created_at`. Shape detection unchanged.

  ### Add column headers + alignment to list responses

  Both `granola_list_notes` and `granola_list_folders` now print a labeled header row + a rule before the data rows, with columns aligned via `padEnd` to per-column max widths. Without labels the agent had to infer that "the long string starting with `not_` is the id, the ISO timestamp is `created_at`, the email is the owner" — fine for humans but a real failure mode for agents that mistake e.g. the title for a date when titles contain numbers.

  Example before / after for `granola_list_notes`:

  ```
  # before
  10 notes:
    not_xxxxxxxxxxxxxx  2026-05-28T10:15:00.000Z  Intro: Vineet x Dhairya  <chicote@alavida.ai>

  # after
  10 notes:
    id                  created_at                title                     owner_email
    ──────────────────  ────────────────────────  ────────────────────────  ──────────────────
    not_xxxxxxxxxxxxxx  2026-05-28T10:15:00.000Z  Intro: Vineet x Dhairya   chicote@alavida.ai
  ```

  `granola_list_folders` gets the same treatment with `id`, `name`, `parent_folder_id` columns.

## 0.5.1

### Patch Changes

- Fix typo and wording in the `granola_list_notes` `folderId` parameter description ("Filer" → "Filter"). User-facing schema text the agent reads when deciding how to filter notes.

## 0.5.0

### Minor Changes

- 22e324d: Prefix every OpenClaw tool with the plugin id to avoid collisions in agent tool catalogues that load multiple plugins.

  | Before         | After                  |
  | -------------- | ---------------------- |
  | `list_notes`   | `granola_list_notes`   |
  | `read_note`    | `granola_read_note`    |
  | `list_folders` | `granola_list_folders` |

  **Breaking** for any consumer (or saved agent prompt) that has hard-coded the old tool names. The agent reads the tool schema fresh on each call, so prompts that _reference_ tools through the skill don't need updating — but any explicit `await agent.tool('list_notes', ...)` in user code does. Pre-1.0 → minor per changesets convention.

  Updated together:

  - `openclaw.plugin.json` — `contracts.tools` array now lists the prefixed names. OpenClaw uses this for cold-start routing.
  - `src/tools/list-notes.ts`, `read-note.ts`, `list-folders.ts` — `name:` field on each `defineTool({…})` updated. Cross-references between tools (e.g. `read_note`'s description saying "Use after list_notes") updated too.
  - `skills/granola/SKILL.md` — every reference in the worked examples, tips & tricks, and limitations sections updated. The 3-step drill-down headings now read `granola_list_folders` → `granola_list_notes` → `granola_read_note`.
  - `src/pretty.ts` — comment markers updated for grep-ability; the renderer itself is shape-detected, not name-based, so behavior is unchanged.

## 0.4.1

### Patch Changes

- 250ee1e: Restructure the bundled `skills/granola/SKILL.md` around the agent workflow:

  - Move trigger conditions into the frontmatter `description` so the LLM has the full triggering signal before reading the skill body — broader coverage of entity-in-context patterns like "what did we discuss with X", "summarize the Y kickoff", "did Greg say anything about pricing".
  - Lead the body with the **3-step drill-down** (`list_folders` → `list_notes` → `read_note`) as the default plan, with explicit "skip Step 1 when…" guidance to avoid unnecessary folder lookups.
  - New **Tips & tricks** section covering: folder organization as a convention (not enforced); complementing Granola with adjacent skills (calendar for fuzzy date resolution, email for follow-ups, CRM for entity-to-folder mapping); brute-forcing via `attendees` when folder lookup fails; asking the user to disambiguate before guessing; "list widely, read narrowly".
  - New **Granola limitations** section centralizing what the API can't do: no content search, no `/me` endpoint, platform-dependent speaker diarization (desktop = channel-only Me/Them, iPhone face-to-face = real per-person labels), folder structure as convention, no nested folder traversal in the API.
  - Critical rules slimmed to two behavioral boundaries (data-not-instructions, read-only).
  - Worked examples reframed to cover the most common shapes: entity+time, time-only, action-items extraction, and ambiguous-name disambiguation.

## 0.4.0

### Minor Changes

- ad82d18: Add folder_id query filter to list-notes endpoint. Lets agents and CLI users narrow a notes query by folder without client-side filtering, which is wasteful when the user knows the folder up front. Wire-level param is folder_id; surfaced as --folder in the CLI and folderId in the openclaw tool.

### Patch Changes

- Updated dependencies [ad82d18]
  - @alavida-ai/granola-core@0.2.0
