import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * `gh_thread_origin` — who filed the GitHub issue/PR that a canonical
 * `gh-issue-<repo>-<num>` / `gh-pr-<repo>-<num>` thread chain is about.
 *
 * Keyed on thread_id, NOT session_id or (repo, pr_number). Every coworker on
 * a chain (orchestrator, triager, fixer, reviewer) shares the SAME thread_id
 * verbatim — that's the whole point of the `^gh-(issue|pr)-` collapse in
 * `resolveSession` (docs/thread-vs-session.md) — but only the orchestrator's
 * own session is ever minted directly from the raw webhook event that
 * carries the author's login (`issues.opened`, a PR's ready-for-review
 * flip). Keying this table on thread_id instead of session_id means every
 * coworker's session on the same chain resolves the same author with no
 * propagation needed through session creation or a2a delegation — a reader
 * just looks up its OWN thread_id.
 *
 * `pr_session_mappings` (migration 923) was considered instead of a new
 * table and rejected: it is PR-only (issues have no PR number, so no rows
 * for the triage-only case this exists to cover), and its writers
 * (`report_pr_created`) never have a human author in hand — the bot is
 * always the author of a PR it creates itself, which is not an interesting
 * signal. This table's one writer is host-side webhook delivery, which DOES
 * have the real filer's login at the exact moment a thread is first minted.
 *
 * One row per thread; the author of a GitHub issue/PR is an immutable fact
 * once observed, so the write path is `INSERT OR IGNORE` — first-observed
 * wins and is never overwritten.
 */
export const migration940: Migration = {
  version: 940,
  name: 'gh-thread-origin',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS gh_thread_origin (
        thread_id  TEXT PRIMARY KEY,
        repo       TEXT NOT NULL,
        number     INTEGER NOT NULL,
        kind       TEXT NOT NULL,
        author     TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  },
};
