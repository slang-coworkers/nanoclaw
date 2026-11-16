/**
 * OpenCode sessions for the transcripts archive (scripts/build-transcripts-archive.ts).
 *
 * Claude Code and Codex sessions leave a session JSONL that claude-code-transcripts renders. An OpenCode
 * session leaves none: its only record is the trace that the runner writes to
 * `groups/<folder>/.opencode-trace/session-<nanoclaw session id>.jsonl` (docs/opencode-trace.md). The archive
 * renders that trace with scripts/opencode-trace-html.py, so an OpenCode session gets a transcript page in
 * the same place as the other two kinds.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Return the trace file of one NanoClaw session, or null when the session left none. */
export function openCodeTracePath(groupsRoot: string, folder: string, sessionId: string): string | null {
  const p = path.join(groupsRoot, folder, '.opencode-trace', `session-${sessionId}.jsonl`);
  return fs.existsSync(p) ? p : null;
}

/** Return the time of the last model call recorded in the trace (its mtime), or 0 when there is no trace. */
export function openCodeActivity(tracePath: string | null): number {
  if (!tracePath) return 0;
  try {
    return fs.statSync(tracePath).mtimeMs;
  } catch {
    return 0;
  }
}

type Runner = (file: string, args: string[], opts: { stdio: ['ignore', 'pipe', 'pipe']; timeout: number }) => unknown;

/**
 * Render one trace to `outFile` with the converter. Returns `{ ok: false, error }` instead of throwing, so one
 * broken trace does not stop the archive build, the same contract as the claude-code-transcripts renderer.
 * The trace index job (ops/claude-trace-www) already writes `session-<id>.html` next to a recent trace; when
 * that page is at least as new as the trace it is copied, so the archive build does not render it twice.
 */
export function renderOpenCodeTranscript(
  converter: string,
  tracePath: string,
  outFile: string,
  run: Runner = execFileSync,
): { ok: boolean; error?: string } {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const page = tracePath.replace(/\.jsonl$/, '.html');
  try {
    if (page !== tracePath && fs.existsSync(page) && fs.statSync(page).mtimeMs >= fs.statSync(tracePath).mtimeMs) {
      fs.copyFileSync(page, outFile);
      return { ok: true };
    }
  } catch {
    // a page that vanished between the checks is simply rendered below
  }
  try {
    run('python3', [converter, tracePath, outFile], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 200) };
  }
}
