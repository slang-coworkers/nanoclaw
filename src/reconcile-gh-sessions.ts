/**
 * src/reconcile-gh-sessions.ts — reconciliation of split GitHub issue/PR
 * coworker sessions. Lives in src/ (not scripts/) so it compiles into dist and
 * can be invoked both from the CLI wrapper (scripts/reconcile-gh-sessions.ts)
 * and automatically at host startup (src/index.ts).
 *
 * Background
 * ----------
 * Before the `^gh-(issue|pr)-` collapse in `resolveSession`
 * (src/session-manager.ts), a single GitHub issue/PR chain could fragment
 * into several NanoClaw sessions for one coworker: the webhook session
 * (messaging_group_id NULL) plus one a2a session per (sender→recipient) pair
 * (each its own synthetic `mg-a2a-*` messaging group). Each session has its
 * own on-disk inbound.db / outbound.db, so a handoff from the triager and a
 * follow-up from main on the SAME issue landed in different containers'
 * memory — a chain-integrity hazard.
 *
 * The forward fix stops NEW splits. This merges the EXISTING ones: every
 * non-canonical session (for a given agent_group + gh-* thread) folds into the
 * canonical session, losslessly and idempotently.
 *
 * Canonical session = the one `findSessionByAgentThread` returns at runtime:
 * earliest-created active session for (agent_group, thread_id), with id as a
 * deterministic tie-break. In practice that's the webhook session.
 *
 * Safety
 * ------
 *   - DRY-RUN unless `apply` is set.
 *   - Preflight aborts if any affected session is live (container_status in
 *     running/idle) or has a SQLite -wal / -journal sidecar next to its DBs —
 *     a live container could write mid-merge. Run with the host service STOPPED
 *     (the startup call runs before any container spawns).
 *   - Merge preserves seq parity (inbound EVEN, outbound ODD) by reassigning
 *     seqs in the canonical DB — `seq` is the agent-facing message id and its
 *     parity routes reaction lookups (docs/db-session.md). Raw seqs are NOT
 *     copied.
 *   - Rows are copied INSERT OR IGNORE keyed on the original message id, so a
 *     re-run never duplicates or re-seqs already-merged rows (idempotent).
 *   - Merged sessions are marked status='closed' (the only non-active value in
 *     Session.status) with a display_title marker; their folders are left on
 *     disk untouched as a backup. Nothing is deleted.
 *   - Backs up v2.db + each mutated canonical/swept session DB before writing.
 *   - Reply routing stays correct after the merge because it is per-message
 *     (messages_in.source_session_id + in_reply_to), not per-session.
 *
 * See docs/thread-vs-session.md for the full model.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface ReconcileOptions {
  /** Data dir holding `v2.db` + `v2-sessions/`. Defaults to repo `data/`. */
  dataDir: string;
  /** Perform the merge. Default false = dry-run. */
  apply?: boolean;
  /** Skip the live-session preflight (DANGEROUS). */
  forceLive?: boolean;
  /** Sink for progress lines. Default: no-op (silent, for tests). */
  log?: (line: string) => void;
}

export interface ReconcileResult {
  /** True if the preflight aborted (live sessions present). No mutation done. */
  abortedLive: boolean;
  /** Number of distinct (agent, gh-thread) groups with >1 session. */
  groups: number;
  /** Number of non-canonical sessions merged (or that would be merged). */
  merged: number;
  /** Inbound rows copied (or that would be). */
  inRows: number;
  /** Outbound rows copied (or that would be). */
  outRows: number;
}

type Sess = {
  id: string;
  agent_group_id: string;
  messaging_group_id: string | null;
  thread_id: string | null;
  status: string;
  container_status: string;
  created_at: string;
};

function inboundPath(sessionsRoot: string, ag: string, sess: string): string {
  return path.join(sessionsRoot, ag, sess, 'inbound.db');
}
function outboundPath(sessionsRoot: string, ag: string, sess: string): string {
  return path.join(sessionsRoot, ag, sess, 'outbound.db');
}

/** A SQLite db is "busy" if a -wal or -journal sidecar exists next to it. */
function hasLiveSidecar(dbPath: string): boolean {
  return ['-wal', '-journal'].some((suffix) => fs.existsSync(dbPath + suffix));
}

/** Max seq across BOTH session tables (global ordering invariant). */
function maxSeqAcross(inDb: Database.Database | null, outDb: Database.Database | null): number {
  let m = 0;
  if (inDb) {
    const r = inDb.prepare('SELECT COALESCE(MAX(seq),0) AS m FROM messages_in').get() as { m: number };
    m = Math.max(m, r.m);
  }
  if (outDb) {
    const r = outDb.prepare('SELECT COALESCE(MAX(seq),0) AS m FROM messages_out').get() as { m: number };
    m = Math.max(m, r.m);
  }
  return m;
}

function nextEven(max: number): number {
  return max < 2 ? 2 : max + 2 - (max % 2);
}
function nextOdd(max: number): number {
  return max % 2 === 0 ? max + 1 : max + 2;
}

/** Column names of a table. */
function tableCols(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
}

/**
 * Copy rows table→table across DBs over the INTERSECTION of both schemas
 * (minus `seq`, which the caller reassigns to preserve parity). Tolerates
 * older/lazily-migrated session DBs that lack newer columns rather than
 * crashing on a hard-coded column list. Idempotent on `id` (INSERT OR IGNORE).
 * `assignSeq` returns the next seq for each newly-copied row. Returns the count
 * of rows actually inserted.
 */
function copyRows(
  src: Database.Database,
  dst: Database.Database,
  table: string,
  idCol: string,
  assignSeq: (() => number) | null,
): number {
  const cols = tableCols(src, table).filter((c) => tableCols(dst, table).includes(c) && c !== 'seq');
  if (!cols.includes(idCol)) return 0;
  const orderBy = tableCols(src, table).includes('seq') ? ' ORDER BY seq ASC' : '';
  const rows = src.prepare(`SELECT ${cols.join(', ')} FROM ${table}${orderBy}`).all() as Array<Record<string, unknown>>;
  const withSeq = assignSeq ? [...cols, 'seq'] : cols;
  const existsStmt = dst.prepare(`SELECT 1 FROM ${table} WHERE ${idCol} = ?`);
  const insStmt = dst.prepare(
    `INSERT OR IGNORE INTO ${table} (${withSeq.join(', ')}) VALUES (${withSeq.map((c) => '@' + c).join(', ')})`,
  );
  let copied = 0;
  const tx = dst.transaction(() => {
    for (const r of rows) {
      if (existsStmt.get(r[idCol] as string)) continue; // already present — keep its seq, don't re-copy
      const row = assignSeq ? { ...r, seq: assignSeq() } : r;
      const res = insStmt.run(row);
      if (res.changes) copied++;
    }
  });
  tx();
  return copied;
}

/** Dry-run count: rows in src not yet present in dst (by id). */
function countNewRows(src: Database.Database, dst: Database.Database, table: string, idCol: string): number {
  const rows = src.prepare(`SELECT ${idCol} FROM ${table}`).all() as Array<Record<string, unknown>>;
  const existsStmt = dst.prepare(`SELECT 1 FROM ${table} WHERE ${idCol} = ?`);
  let n = 0;
  for (const r of rows) if (!existsStmt.get(r[idCol] as string)) n++;
  return n;
}

/**
 * Reconcile split gh-issue/gh-pr sessions in `dataDir`. Pure function over the
 * filesystem + central DB; returns a summary. Idempotent.
 */
export function reconcileGhSessions(opts: ReconcileOptions): ReconcileResult {
  const apply = !!opts.apply;
  const forceLive = !!opts.forceLive;
  const log = opts.log ?? (() => {});
  const centralDbPath = path.join(opts.dataDir, 'v2.db');
  const sessionsRoot = path.join(opts.dataDir, 'v2-sessions');

  const central = new Database(centralDbPath);
  try {
    // ── Build the work list: (agent_group, gh-* thread) with >1 active session ──
    const groups = central
      .prepare(
        `SELECT agent_group_id, thread_id, COUNT(*) AS n
           FROM sessions
          WHERE status = 'active'
            AND (thread_id LIKE 'gh-issue-%' OR thread_id LIKE 'gh-pr-%')
          GROUP BY agent_group_id, thread_id
          HAVING COUNT(*) > 1
          ORDER BY agent_group_id, thread_id`,
      )
      .all() as Array<{ agent_group_id: string; thread_id: string; n: number }>;

    if (groups.length === 0) {
      log('No split gh-issue/gh-pr sessions found. Nothing to do.');
      return { abortedLive: false, groups: 0, merged: 0, inRows: 0, outRows: 0 };
    }

    log(`${apply ? 'APPLY' : 'DRY-RUN'}: ${groups.length} split gh-* thread(s) to reconcile.\n`);

    const sessionsFor = (g: { agent_group_id: string; thread_id: string }) =>
      central
        .prepare(
          `SELECT id, agent_group_id, messaging_group_id, thread_id, status, container_status, created_at
             FROM sessions
            WHERE status = 'active' AND agent_group_id = ? AND thread_id = ?
            ORDER BY created_at ASC, id ASC`,
        )
        .all(g.agent_group_id, g.thread_id) as Sess[];

    // ── Preflight: refuse to touch live sessions ──
    const allAffected: Sess[] = groups.flatMap((g) => sessionsFor(g));
    const live = allAffected.filter(
      (s) =>
        s.container_status === 'running' ||
        s.container_status === 'idle' ||
        hasLiveSidecar(inboundPath(sessionsRoot, s.agent_group_id, s.id)) ||
        hasLiveSidecar(outboundPath(sessionsRoot, s.agent_group_id, s.id)),
    );
    if (live.length > 0 && !forceLive) {
      log(`ABORT: ${live.length} affected session(s) appear live (running/idle or -wal/-journal present):`);
      for (const s of live) log(`  ${s.id} (${s.agent_group_id}) container_status=${s.container_status}`);
      log('\nStop the host service and retry, or pass --force-live to override (DANGEROUS).');
      return { abortedLive: true, groups: groups.length, merged: 0, inRows: 0, outRows: 0 };
    }

    // ── Backup before any mutation (apply only) ──
    // Copy v2.db (+ -wal/-shm if present) next to it with a timestamp. Session
    // folders are NOT copied — merged sessions are left intact on disk and the
    // canonical DBs are the only session files mutated, so v2.db + the canonical
    // session DBs are the recovery surface. We snapshot v2.db (the index of what
    // merged into what); the merged session folders themselves remain as backup.
    const stamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15);
    const backedUp = new Set<string>();
    // Copy a DB file (+ -wal/-shm) once to a timestamped sibling. Idempotent
    // within a run via `backedUp` so a canonical DB touched by both the merge
    // and the final sweep is snapshotted only once.
    const backupDb = (dbPath: string) => {
      if (!apply || backedUp.has(dbPath)) return;
      backedUp.add(dbPath);
      for (const suffix of ['', '-wal', '-shm']) {
        const src = dbPath + suffix;
        if (fs.existsSync(src)) fs.copyFileSync(src, `${dbPath}.bak-reconcile-${stamp}${suffix}`);
      }
    };
    if (apply) {
      backupDb(centralDbPath);
      log(`backup: ${path.basename(centralDbPath)}.bak-reconcile-${stamp}`);
    }

    // merged session id → canonical session id, accumulated across all groups,
    // so a final sweep can rewrite messages_in.source_session_id references that
    // live in OTHER sessions' inbound DBs (a merged recipient session id stamped
    // on a reply row). Without this, resolveExplicitReplyTarget's active-session
    // check fails for in_reply_to replies that resolve to a now-closed session.
    const rewriteMap = new Map<string, string>();

    let totalMerged = 0;
    let totalInRows = 0;
    let totalOutRows = 0;

    for (const g of groups) {
      const sessions = sessionsFor(g);
      const canonical = sessions[0];
      const merges = sessions.slice(1);
      log(`▶ ${g.agent_group_id}  ${g.thread_id}`);
      log(`   canonical: ${canonical.id} (mg=${canonical.messaging_group_id ?? 'NULL'}, ${canonical.created_at})`);

      const canInPath = inboundPath(sessionsRoot, canonical.agent_group_id, canonical.id);
      const canOutPath = outboundPath(sessionsRoot, canonical.agent_group_id, canonical.id);
      // Back up the canonical session DBs before they're mutated by the merge.
      backupDb(canInPath);
      backupDb(canOutPath);
      const canIn = fs.existsSync(canInPath) ? new Database(canInPath) : null;
      const canOut = fs.existsSync(canOutPath) ? new Database(canOutPath) : null;

      // Running seq counter, seeded from the canonical DBs' current max.
      let seqCounter = maxSeqAcross(canIn, canOut);

      for (const m of merges) {
        const mInPath = inboundPath(sessionsRoot, m.agent_group_id, m.id);
        const mOutPath = outboundPath(sessionsRoot, m.agent_group_id, m.id);
        const mIn = fs.existsSync(mInPath) ? new Database(mInPath, { readonly: true }) : null;
        const mOut = fs.existsSync(mOutPath) ? new Database(mOutPath, { readonly: true }) : null;

        let inCopied = 0;
        let outCopied = 0;
        let delCopied = 0;

        // ---- inbound rows → canonical inbound.db (next EVEN seq) ----
        // Column lists are the intersection of both schemas (copyRows), so an
        // older/lazily-migrated session DB missing newer columns won't crash.
        if (mIn && canIn) {
          if (apply) inCopied = copyRows(mIn, canIn, 'messages_in', 'id', () => (seqCounter = nextEven(seqCounter)));
          else inCopied = countNewRows(mIn, canIn, 'messages_in', 'id');
        }

        // ---- delivered rows → canonical inbound.db (keyed on message_out_id) ----
        if (mIn && canIn) {
          if (apply) delCopied = copyRows(mIn, canIn, 'delivered', 'message_out_id', null);
          else delCopied = countNewRows(mIn, canIn, 'delivered', 'message_out_id');
        }

        // ---- outbound rows → canonical outbound.db (next ODD seq) ----
        if (mOut && canOut) {
          if (apply) outCopied = copyRows(mOut, canOut, 'messages_out', 'id', () => (seqCounter = nextOdd(seqCounter)));
          else outCopied = countNewRows(mOut, canOut, 'messages_out', 'id');
        }

        mIn?.close();
        mOut?.close();

        log(
          `   ← merge ${m.id} (mg=${m.messaging_group_id ?? 'NULL'}): +${inCopied} in, +${outCopied} out, +${delCopied} delivered`,
        );
        totalInRows += inCopied;
        totalOutRows += outCopied;
        totalMerged++;
        rewriteMap.set(m.id, canonical.id);
      }

      canIn?.close();
      canOut?.close();

      // ---- central DB: re-point a2a lineage + close merged sessions ----
      if (apply) {
        const cols = new Set(
          (central.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>).map((c) => c.name),
        );
        const tx = central.transaction(() => {
          for (const m of merges) {
            // Re-point a2a_session_sources references (recipient + source) so
            // ancestor walks still resolve to the canonical session. The table
            // is 1-row-per-recipient (PK); on collision keep the existing
            // canonical row and drop the now-redundant merged one.
            central
              .prepare(
                `UPDATE OR IGNORE a2a_session_sources SET recipient_session_id = ? WHERE recipient_session_id = ?`,
              )
              .run(canonical.id, m.id);
            central.prepare(`DELETE FROM a2a_session_sources WHERE recipient_session_id = ?`).run(m.id);
            central
              .prepare(`UPDATE a2a_session_sources SET source_session_id = ? WHERE source_session_id = ?`)
              .run(canonical.id, m.id);

            // Mark merged session closed + auditable marker. status is only
            // 'active' | 'closed' (src/types.ts) — do NOT invent a new value.
            const marker = `[merged→${canonical.id}]`;
            if (cols.has('display_title')) {
              central
                .prepare(`UPDATE sessions SET status = 'closed', display_title = ? WHERE id = ?`)
                .run(marker, m.id);
            } else {
              central.prepare(`UPDATE sessions SET status = 'closed' WHERE id = ?`).run(m.id);
            }
          }
        });
        tx();
      }
      log('');
    }

    // ── Final sweep: rewrite messages_in.source_session_id references that
    // point at a merged (now-closed) session, across EVERY active session's
    // inbound DB. A reply row in some other agent's inbox carries the merged
    // recipient session id as its source; resolveExplicitReplyTarget requires
    // that origin be active, so an in_reply_to reply would otherwise fail to
    // route after the merge. Rewriting to the canonical id keeps replies homed.
    let srcRewrites = 0;
    if (apply && rewriteMap.size > 0) {
      const allActive = central
        .prepare("SELECT id, agent_group_id FROM sessions WHERE status = 'active'")
        .all() as Array<{ id: string; agent_group_id: string }>;
      for (const s of allActive) {
        const inPath = inboundPath(sessionsRoot, s.agent_group_id, s.id);
        if (!fs.existsSync(inPath)) continue;
        let sdb: Database.Database | null = null;
        try {
          sdb = new Database(inPath);
          // Skip DBs without the column (older/lazily-migrated session DBs).
          const hasCol = (sdb.prepare('PRAGMA table_info(messages_in)').all() as Array<{ name: string }>).some(
            (c) => c.name === 'source_session_id',
          );
          if (!hasCol) continue;
          // Back up this inbound DB before mutating it (no-op if already backed
          // up as a canonical above). Skip the backup+write entirely if no row
          // references a merged session.
          const merged = [...rewriteMap.keys()];
          const placeholders = merged.map(() => '?').join(',');
          const affected = (
            sdb
              .prepare(`SELECT COUNT(*) AS n FROM messages_in WHERE source_session_id IN (${placeholders})`)
              .get(...merged) as { n: number }
          ).n;
          if (affected === 0) continue;
          sdb.close();
          sdb = null;
          backupDb(inPath);
          sdb = new Database(inPath);
          const upd = sdb.prepare('UPDATE messages_in SET source_session_id = ? WHERE source_session_id = ?');
          const tx = sdb.transaction(() => {
            for (const [m, canon] of rewriteMap) {
              const res = upd.run(canon, m);
              srcRewrites += res.changes;
            }
          });
          tx();
        } catch {
          /* a busy/locked session DB is skipped — preflight already excluded live ones */
        } finally {
          sdb?.close();
        }
      }
      if (srcRewrites > 0) log(`source_session_id rewrites (reply-route repair): ${srcRewrites}`);
    }

    log(
      `${apply ? 'DONE' : 'DRY-RUN COMPLETE'}: ${totalMerged} session(s) ${apply ? 'merged into' : 'would merge into'} their canonical, ` +
        `${totalInRows} inbound + ${totalOutRows} outbound rows ${apply ? 'copied' : 'to copy'}.`,
    );
    if (!apply) log('\nRe-run with --apply (host service stopped, v2.db backed up) to perform the merge.');

    return {
      abortedLive: false,
      groups: groups.length,
      merged: totalMerged,
      inRows: totalInRows,
      outRows: totalOutRows,
    };
  } finally {
    central.close();
  }
}
