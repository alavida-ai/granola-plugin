---
"@alavida-ai/granola-plugin-openclaw": patch
---

Fix `granola_list_notes` pretty rendering — every note was displaying `<?>` for the owner and an empty date column.

The bug: `granola_list_notes` shapes the wire response into flat headlines with `ownerEmail` / `createdAt` (camelCase, single-level) to make the payload smaller and easier for agents to scan. But the pretty renderer's `NoteShape` interface still described the raw wire shape (nested `owner.email`, snake_case `created_at`). The renderer would read `n.owner?.email` against the flat shape, find nothing, and fall back to `?`. Same story for `n.created_at` falling back to `''`.

The two shapes never agreed — they were inconsistent from the original rewrite in PR #6. Nothing surfaced because the CLI uses its own renderer against the raw wire shape, and the OpenClaw tool wasn't exercised through a real agent until production.

Fix: split the renderer's note-type into two explicit interfaces — `NoteHeadline` (flat, used by `granola_list_notes`) and `NoteDetail` (nested wire, used by `granola_read_note`). `renderNoteList` now reads `n.ownerEmail` / `n.createdAt`; `renderSingleNote` keeps reading `n.owner?.email` / `n.created_at`. Shape detection unchanged (still keys off `p.notes` array vs `p.id + summary fields`).

Behavior of `output: 'json'` and the raw `details` payload is unchanged — only the pretty (default) rendering was wrong.
