---
"@alavida-ai/granola-plugin-openclaw": patch
---

Two fixes to the pretty rendering of list responses (`granola_list_notes`, `granola_list_folders`). Both improve how the default (`output: 'pretty'`) text payload looks to the agent — `output: 'json'` and the raw `details` payload are unchanged.

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
