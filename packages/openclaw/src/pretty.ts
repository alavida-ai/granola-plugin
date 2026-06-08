/**
 * Shape-detected pretty renderer for granola tool results.
 *
 * Three known shapes (notes list, single note, folders list) plus the error
 * envelope. Each renderer returns compact human/agent-readable text — the raw
 * payload is always available on `AgentToolResult.details` for chaining.
 */
import { isToolErrorEnvelope, type ToolErrorEnvelope } from './errors.js';

const SNIPPET_MAX = 120;

/** Render an arbitrary tool payload as compact text. */
export function renderPretty(payload: unknown): string {
  if (payload === undefined || payload === null) return '(no result)';

  if (isToolErrorEnvelope(payload)) {
    return renderError(payload);
  }

  if (isObject(payload)) {
    const p = payload as Record<string, unknown>;

    // granola_list_notes — {notes: NoteHeadline[], nextCursor, hasMore}
    if (Array.isArray(p.notes)) {
      return renderNoteList(p.notes as NoteHeadline[], {
        cursor: typeof p.nextCursor === 'string' ? p.nextCursor : null,
        hasMore: p.hasMore === true,
      });
    }
    // granola_list_folders — {folders, nextCursor, hasMore}
    if (Array.isArray(p.folders)) {
      return renderFolderList(p.folders as FolderShape[], {
        cursor: typeof p.nextCursor === 'string' ? p.nextCursor : null,
        hasMore: p.hasMore === true,
      });
    }
    // granola_read_note — single note (raw wire shape: id + summary_markdown/text)
    if (typeof p.id === 'string' && ('summary_markdown' in p || 'summary_text' in p || 'title' in p)) {
      return renderSingleNote(p as NoteDetail);
    }
  }

  // Generic fallback — JSON.stringify (truncated for readability).
  try {
    const text = JSON.stringify(payload, null, 2);
    return text.length > 4000 ? text.slice(0, 4000) + '\n…(truncated; use output: json)' : text;
  } catch {
    return String(payload);
  }
}

// ─── renderers ───────────────────────────────────────────────────────────────

/**
 * Two distinct note shapes flow through this renderer:
 *
 *   - `granola_list_notes` returns shaped headlines (flat camelCase fields).
 *     See `tools/list-notes.ts` — the tool maps the wire response to this
 *     shape before returning, so the agent gets a smaller, easier-to-scan
 *     payload.
 *   - `granola_read_note` returns the raw wire note (nested `owner`,
 *     snake_case `created_at`, etc.) verbatim from `client.notes.get()`.
 *
 * They need different renderers because the field names differ. Keeping the
 * interfaces separate prevents the "every note shows <?>" bug we hit in
 * production — the previous shared interface read `n.owner?.email` against
 * the flat headline shape, where that field doesn't exist.
 */
interface NoteHeadline {
  id?: string;
  title?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface NoteDetail {
  id?: string;
  title?: string | null;
  owner?: { name?: string | null; email?: string | null };
  created_at?: string;
  updated_at?: string;
  summary_markdown?: string | null;
  summary_text?: string | null;
  folder_membership?: Array<{ id?: string; name?: string | null }>;
  transcript?: Array<{ speaker?: string | null; text?: string; start_time?: string }>;
}

interface FolderShape {
  id?: string;
  name?: string | null;
  parent_folder_id?: string | null;
}

interface PaginationFooter {
  cursor: string | null;
  hasMore: boolean;
}

function renderNoteList(notes: NoteHeadline[], page: PaginationFooter): string {
  if (notes.length === 0) return '(no notes)';

  // Project to scalar rows, then compute per-column widths so the table aligns
  // and the header lines up with the data. Headers help the agent reason about
  // which token is which field; agents (and humans) regularly mistake the title
  // for the date when there's no label.
  const rows = notes.map((n) => ({
    id: n.id ?? '?',
    created: n.createdAt ?? '',
    title: n.title?.trim() || '(untitled)',
    owner: n.ownerEmail ?? '?',
  }));
  const cols: Array<keyof (typeof rows)[number]> = ['id', 'created', 'title', 'owner'];
  const headers = { id: 'id', created: 'created_at', title: 'title', owner: 'owner_email' };
  const widths = Object.fromEntries(
    cols.map((c) => [c, Math.max(headers[c].length, ...rows.map((r) => r[c].length))]),
  ) as Record<(typeof cols)[number], number>;
  const fmtRow = (r: Record<(typeof cols)[number], string>) =>
    `  ${cols.map((c) => r[c].padEnd(widths[c])).join('  ')}`;

  const lines = [
    `${notes.length} note${notes.length === 1 ? '' : 's'}:`,
    fmtRow(headers),
    `  ${cols.map((c) => '─'.repeat(widths[c])).join('  ')}`,
    ...rows.map(fmtRow),
  ];
  if (page.hasMore && page.cursor) {
    lines.push('');
    lines.push(`(more available — pass pageToken="${page.cursor}" to continue)`);
  }
  return lines.join('\n');
}

function renderSingleNote(n: NoteDetail): string {
  const title = n.title?.trim() || '(untitled)';
  const lines: string[] = [
    title,
    `  id:      ${n.id ?? '?'}`,
    `  owner:   <${n.owner?.email ?? '?'}>`,
  ];
  if (n.created_at) lines.push(`  created: ${n.created_at}`);
  const folders = n.folder_membership ?? [];
  if (folders.length > 0) {
    lines.push(`  folders: ${folders.map((f) => f.name ?? f.id ?? '?').join(', ')}`);
  }
  lines.push('');

  const body = (n.summary_markdown ?? n.summary_text ?? '').trim();
  if (body) {
    lines.push(body.length > 2000 ? body.slice(0, 2000) + '\n…(truncated; use output: json)' : body);
  } else {
    lines.push('(no summary)');
  }

  if (Array.isArray(n.transcript) && n.transcript.length > 0) {
    lines.push('');
    lines.push(`── transcript (${n.transcript.length} segments) ──`);
    const sample = n.transcript.slice(0, 8);
    for (const seg of sample) {
      const speaker = seg.speaker ?? '?';
      const t = seg.start_time ?? '';
      const txt = (seg.text ?? '').replace(/\s+/g, ' ').trim();
      const snippet = txt.length > SNIPPET_MAX ? txt.slice(0, SNIPPET_MAX) + '…' : txt;
      lines.push(`  [${t}] ${speaker}: ${snippet}`);
    }
    if (n.transcript.length > sample.length) {
      lines.push(`  …(${n.transcript.length - sample.length} more segments; use output: json)`);
    }
  }
  return lines.join('\n');
}

function renderFolderList(folders: FolderShape[], page: PaginationFooter): string {
  if (folders.length === 0) return '(no folders)';

  const rows = folders.map((f) => ({
    id: f.id ?? '?',
    name: f.name ?? '(unnamed)',
    parent: f.parent_folder_id ?? '',
  }));
  const cols: Array<keyof (typeof rows)[number]> = ['id', 'name', 'parent'];
  const headers = { id: 'id', name: 'name', parent: 'parent_folder_id' };
  const widths = Object.fromEntries(
    cols.map((c) => [c, Math.max(headers[c].length, ...rows.map((r) => r[c].length))]),
  ) as Record<(typeof cols)[number], number>;
  const fmtRow = (r: Record<(typeof cols)[number], string>) =>
    `  ${cols.map((c) => r[c].padEnd(widths[c])).join('  ')}`;

  const lines = [
    `${folders.length} folder${folders.length === 1 ? '' : 's'}:`,
    fmtRow(headers),
    `  ${cols.map((c) => '─'.repeat(widths[c])).join('  ')}`,
    ...rows.map(fmtRow),
  ];
  if (page.hasMore && page.cursor) {
    lines.push('');
    lines.push(`(more available — pass pageToken="${page.cursor}" to continue)`);
  }
  return lines.join('\n');
}

function renderError(envelope: ToolErrorEnvelope): string {
  const e = envelope.__toolError;
  const lines = [`✗ ${e.error}`, `  ${e.message}`];
  if (e.hint) lines.push(`  → ${e.hint}`);
  if (e.retryAfterSeconds !== undefined) lines.push(`  retry after: ${e.retryAfterSeconds}s`);
  return lines.join('\n');
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
