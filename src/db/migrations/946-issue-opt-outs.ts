import type { Migration } from './index.js';

/**
 * `issue_opt_outs` and `issue_stand_downs` — the host-side record of the two
 * R6 ("the bot leaves room for people") switches on a GitHub issue.
 *
 * Why: the bot processes every new issue by default. People opt an issue out
 * by labelling it (`GoodFirstBug`, `HelpWanted`, `no-bot` by default) or by
 * telling the bot to stop in a comment; the host must then stop the running
 * chain, keep every coworker from writing to that issue, and let the issue back
 * in when the label goes. A row here is the durable form of that decision: the
 * webhook writes it, the per-group opt-out list files are derived from it, and
 * the weekly compliance check reads it back. `released_at` closes a row when
 * the last newcomer label is removed; the row stays as history.
 *
 * `issue_stand_downs` records the one stand-down note the host (or a coworker)
 * leaves on an issue nobody worked for a day, so the backstop never posts twice.
 */
export const migration946: Migration = {
  version: 946,
  name: 'issue-opt-outs',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS issue_opt_outs (
        repo             TEXT    NOT NULL,
        issue_number     INTEGER NOT NULL,
        label            TEXT    NOT NULL,
        actor            TEXT    NOT NULL DEFAULT '',
        source           TEXT    NOT NULL,
        opted_out_at     TEXT    NOT NULL,
        released_at      TEXT,
        sessions_stopped INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (repo, issue_number)
      );

      CREATE TABLE IF NOT EXISTS issue_stand_downs (
        repo         TEXT    NOT NULL,
        issue_number INTEGER NOT NULL,
        kind         TEXT    NOT NULL,
        comment_id   INTEGER,
        posted_at    TEXT    NOT NULL,
        PRIMARY KEY (repo, issue_number)
      );
    `);
  },
};
