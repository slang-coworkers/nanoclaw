import type { PendingApproval, PendingQuestion, Session } from '../types.js';
import { getDb, hasTable } from './connection.js';

// ── Sessions ──

export const TASKS_SYSTEM_THREAD_ID = 'system:tasks';

export function createSession(session: Session): void {
  // Migration 021 guarantees display_title / title_source / title_updated_at
  // exist — runMigrations() runs at host startup before any createSession
  // call. No defensive column probe here; trust the migration.
  getDb()
    .prepare(
      `INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id,
                             display_title, title_source, title_updated_at,
                             agent_provider, status, container_status, last_active, created_at)
       VALUES (@id, @agent_group_id, @messaging_group_id, @thread_id,
               @display_title, @title_source, @title_updated_at,
               @agent_provider, @status, @container_status, @last_active, @created_at)`,
    )
    .run({ display_title: null, title_source: null, title_updated_at: null, ...session });
}

/**
 * Update the session's display title. `source='manual'` marks it
 * operator-set so the heuristic titler won't re-derive on top of it.
 * Returns true if a row was updated (i.e. the session still exists).
 */
export function updateSessionTitle(
  sessionId: string,
  displayTitle: string,
  source: 'auto' | 'heuristic' | 'manual',
  now: string = new Date().toISOString(),
): boolean {
  // Never overwrite a manual title unless the new write is also manual.
  const clause =
    source === 'manual'
      ? 'WHERE id = ?'
      : "WHERE id = ? AND (display_title IS NULL OR COALESCE(title_source, '') != 'manual')";
  const res = getDb()
    .prepare(`UPDATE sessions SET display_title = ?, title_source = ?, title_updated_at = ? ${clause}`)
    .run(displayTitle, source, now, sessionId);
  return res.changes > 0;
}

export function getSession(id: string): Session | undefined {
  return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
}

export function findSession(messagingGroupId: string, threadId: string | null): Session | undefined {
  if (threadId) {
    return getDb()
      .prepare('SELECT * FROM sessions WHERE messaging_group_id = ? AND thread_id = ? AND status = ?')
      .get(messagingGroupId, threadId, 'active') as Session | undefined;
  }
  return getDb()
    .prepare('SELECT * FROM sessions WHERE messaging_group_id = ? AND thread_id IS NULL AND status = ?')
    .get(messagingGroupId, 'active') as Session | undefined;
}

/**
 * Session lookup scoped to a specific agent group. Needed when multiple
 * agents are wired to the same messaging group + thread (fan-out) — the
 * plain `findSession` would return whichever agent's session happened to
 * be first and route to the wrong container.
 */
export function findSessionForAgent(
  agentGroupId: string,
  messagingGroupId: string,
  threadId: string | null,
): Session | undefined {
  if (threadId) {
    return getDb()
      .prepare(
        "SELECT * FROM sessions WHERE agent_group_id = ? AND messaging_group_id = ? AND thread_id = ? AND status = 'active'",
      )
      .get(agentGroupId, messagingGroupId, threadId) as Session | undefined;
  }
  return getDb()
    .prepare(
      "SELECT * FROM sessions WHERE agent_group_id = ? AND messaging_group_id = ? AND thread_id IS NULL AND status = 'active'",
    )
    .get(agentGroupId, messagingGroupId) as Session | undefined;
}

/** Find an active session for an agent + thread, ignoring messaging group. */
export function findSessionByAgentThread(agentGroupId: string, threadId: string): Session | undefined {
  return getDb()
    .prepare(
      // created_at ASC picks the earliest (canonical) session for a thread; id ASC
      // is a deterministic tie-break so a created_at collision can't make the
      // canonical choice nondeterministic (the gh-issue/pr collapse in
      // resolveSession depends on a stable winner).
      "SELECT * FROM sessions WHERE agent_group_id = ? AND thread_id = ? AND status = 'active' ORDER BY created_at ASC, id ASC LIMIT 1",
    )
    .get(agentGroupId, threadId) as Session | undefined;
}

/**
 * Does any active session exist for this issue's chain, keyed on its canonical
 * `gh-issue-<repo>-<num>` thread_id (any agent group)? Used by the webhook
 * comment gate to recognize "this issue is ours" — a follow-up comment on an
 * issue we're already driving is processed even without an @-mention (the live
 * chain IS the ownership signal, mirroring isOwnedPr/prMappingExists for PRs).
 * Returns false (never throws) if the sessions table is unavailable.
 */
export function issueSessionExists(repo: string, issueNumber: number): boolean {
  try {
    const row = getDb()
      .prepare("SELECT 1 FROM sessions WHERE thread_id = ? AND status = 'active' LIMIT 1")
      .get(`gh-issue-${repo}-${issueNumber}`) as { 1: number } | undefined;
    return Boolean(row);
  } catch {
    return false;
  }
}

/** Find an active session scoped to an agent group (ignoring messaging group). */
export function findSessionByAgentGroup(agentGroupId: string): Session | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM sessions
       WHERE agent_group_id = ?
         AND status = 'active'
         AND NOT (messaging_group_id IS NULL AND thread_id IS NOT NULL AND thread_id LIKE 'system:%')
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(agentGroupId) as Session | undefined;
}

export function getSessionsByAgentGroup(agentGroupId: string): Session[] {
  return getDb().prepare('SELECT * FROM sessions WHERE agent_group_id = ?').all(agentGroupId) as Session[];
}

export function findSystemSession(agentGroupId: string, threadId: string): Session | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM sessions
       WHERE agent_group_id = ?
         AND messaging_group_id IS NULL
         AND thread_id = ?
         AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(agentGroupId, threadId) as Session | undefined;
}

/** Per-task session thread id for a scheduled task series. */
export function taskThreadId(seriesId: string): string {
  return `${TASKS_SYSTEM_THREAD_ID}:${seriesId}`;
}

/** True for any task session thread — a per-series one or the legacy shared one. */
export function isTaskThread(threadId: string | null): boolean {
  return threadId === TASKS_SYSTEM_THREAD_ID || (threadId?.startsWith(`${TASKS_SYSTEM_THREAD_ID}:`) ?? false);
}

/** All active task sessions for a group — one per live series, plus any legacy shared one. */
export function findTaskSessions(agentGroupId: string): Session[] {
  return getDb()
    .prepare(
      `SELECT * FROM sessions
       WHERE agent_group_id = ?
         AND messaging_group_id IS NULL
         AND status = 'active'
         AND (thread_id = ? OR thread_id LIKE ?)
       ORDER BY created_at DESC`,
    )
    .all(agentGroupId, TASKS_SYSTEM_THREAD_ID, `${TASKS_SYSTEM_THREAD_ID}:%`) as Session[];
}

/**
 * All active sessions for a group, whatever their thread shape.
 *
 * Task rows are `messages_in` rows with `kind='task'`, so the only reliable way
 * to find a group's tasks is to scan its sessions' inbound DBs — which is what
 * the global (no `--group`) CLI path already does via `getActiveSessions`.
 * `findTaskSessions` is narrower: it only matches the isolated `system:tasks`
 * sessions the scheduler creates today, so it silently misses legacy task rows
 * parked in ordinary sessions (thread_id NULL / a messaging_group_id set).
 * Group-scoped lookups use this instead so they stay consistent with the
 * global path rather than reporting "no tasks" for tasks that plainly exist.
 */
export function getActiveSessionsForGroup(agentGroupId: string): Session[] {
  return getDb()
    .prepare("SELECT * FROM sessions WHERE agent_group_id = ? AND status = 'active' ORDER BY created_at DESC")
    .all(agentGroupId) as Session[];
}

export function getActiveSessions(): Session[] {
  return getDb().prepare("SELECT * FROM sessions WHERE status = 'active'").all() as Session[];
}

export function getRunningSessions(): Session[] {
  return getDb().prepare("SELECT * FROM sessions WHERE container_status IN ('running', 'idle')").all() as Session[];
}

export function updateSession(
  id: string,
  updates: Partial<Pick<Session, 'status' | 'container_status' | 'last_active' | 'agent_provider'>>,
): void {
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length === 0) return;

  getDb()
    .prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = @id`)
    .run(values);
}

export function deleteSession(id: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

// ── Pending Questions ──

/**
 * Insert a pending question row. Idempotent: when delivery fails and retries,
 * the second attempt calls this with the same question_id — without `OR
 * IGNORE` that would throw UNIQUE and prevent the retry from reaching the
 * actual send step. Returns true if a new row was inserted.
 */
export function createPendingQuestion(pq: PendingQuestion): boolean {
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO pending_questions (question_id, session_id, message_out_id, platform_id, channel_type, thread_id, title, options_json, created_at)
       VALUES (@question_id, @session_id, @message_out_id, @platform_id, @channel_type, @thread_id, @title, @options_json, @created_at)`,
    )
    .run({
      question_id: pq.question_id,
      session_id: pq.session_id,
      message_out_id: pq.message_out_id,
      platform_id: pq.platform_id,
      channel_type: pq.channel_type,
      thread_id: pq.thread_id,
      title: pq.title,
      options_json: JSON.stringify(pq.options),
      created_at: pq.created_at,
    });
  return result.changes > 0;
}

export function getPendingQuestion(questionId: string): PendingQuestion | undefined {
  const row = getDb().prepare('SELECT * FROM pending_questions WHERE question_id = ?').get(questionId) as
    | (Omit<PendingQuestion, 'options'> & { options_json: string })
    | undefined;
  if (!row) return undefined;
  const { options_json, ...rest } = row;
  return { ...rest, options: JSON.parse(options_json) };
}

export function deletePendingQuestion(questionId: string): void {
  getDb().prepare('DELETE FROM pending_questions WHERE question_id = ?').run(questionId);
}

// ── Pending Approvals ──

/**
 * Insert a pending approval row. Idempotent for the same reason as
 * createPendingQuestion: delivery retries with the same approval_id must not
 * fail on UNIQUE before the send step gets a chance to succeed.
 */
export function createPendingApproval(
  pa: Partial<PendingApproval> &
    Pick<
      PendingApproval,
      'approval_id' | 'request_id' | 'action' | 'payload' | 'created_at' | 'title' | 'options_json'
    >,
): boolean {
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO pending_approvals
         (approval_id, session_id, request_id, action, payload, created_at,
          agent_group_id, channel_type, platform_id, platform_message_id, expires_at, status,
          title, options_json, approver_user_id)
       VALUES
         (@approval_id, @session_id, @request_id, @action, @payload, @created_at,
          @agent_group_id, @channel_type, @platform_id, @platform_message_id, @expires_at, @status,
          @title, @options_json, @approver_user_id)`,
    )
    .run({
      session_id: null,
      agent_group_id: null,
      channel_type: null,
      platform_id: null,
      platform_message_id: null,
      expires_at: null,
      status: 'pending',
      approver_user_id: null,
      ...pa,
    });
  return result.changes > 0;
}

export function getPendingApproval(approvalId: string): PendingApproval | undefined {
  return getDb().prepare('SELECT * FROM pending_approvals WHERE approval_id = ?').get(approvalId) as
    | PendingApproval
    | undefined;
}

export function updatePendingApprovalStatus(approvalId: string, status: PendingApproval['status']): void {
  getDb().prepare('UPDATE pending_approvals SET status = ? WHERE approval_id = ?').run(status, approvalId);
}

export function updatePendingApprovalDelivery(
  approvalId: string,
  updates: Pick<PendingApproval, 'channel_type' | 'platform_id' | 'platform_message_id'>,
): void {
  getDb()
    .prepare(
      `UPDATE pending_approvals
       SET channel_type = ?, platform_id = ?, platform_message_id = ?
       WHERE approval_id = ?`,
    )
    .run(updates.channel_type, updates.platform_id, updates.platform_message_id, approvalId);
}

/**
 * Park an approval in the "rejected, awaiting reason" hold: the admin clicked
 * "Reject with reason…" and we're waiting for their one-line reply. `expiresAt`
 * is the deadline after which the host sweep finalizes a plain reject (so a
 * ghosted hold never strands the requesting agent). Reuses the otherwise-unused
 * `expires_at` column on module-initiated rows.
 */
export function markApprovalAwaitingReason(approvalId: string, expiresAt: string): void {
  getDb()
    .prepare("UPDATE pending_approvals SET status = 'awaiting_reason', expires_at = ? WHERE approval_id = ?")
    .run(expiresAt, approvalId);
}

/** Awaiting-reason approvals whose reply window has elapsed — the sweep's ghost set. */
export function getExpiredAwaitingReasonApprovals(nowIso: string): PendingApproval[] {
  return getDb()
    .prepare(
      "SELECT * FROM pending_approvals WHERE status = 'awaiting_reason' AND expires_at IS NOT NULL AND expires_at <= ?",
    )
    .all(nowIso) as PendingApproval[];
}

export function deletePendingApproval(approvalId: string): void {
  getDb().prepare('DELETE FROM pending_approvals WHERE approval_id = ?').run(approvalId);
}

export function getPendingApprovalsByAction(action: string): PendingApproval[] {
  return getDb().prepare('SELECT * FROM pending_approvals WHERE action = ?').all(action) as PendingApproval[];
}

/**
 * Resolve ask_question render metadata (title + normalized options) for any
 * card, regardless of whether it was persisted as a pending_question (generic
 * ask_user_question) or a pending_approval (self-mod / OneCLI credential).
 */
export function getAskQuestionRender(
  id: string,
): { title: string; options: import('../channels/ask-question.js').NormalizedOption[] } | undefined {
  const q = getPendingQuestion(id);
  if (q) return { title: q.title, options: q.options };
  const a = getDb().prepare('SELECT title, options_json FROM pending_approvals WHERE approval_id = ?').get(id) as
    | { title: string; options_json: string }
    | undefined;
  if (a?.title) return { title: a.title, options: JSON.parse(a.options_json) };

  // Channel-registration + unknown-sender approvals persist title/options_json
  // the same way pending_approvals does — just SELECT and return.
  if (hasTable(getDb(), 'pending_channel_approvals')) {
    const c = getDb()
      .prepare('SELECT title, options_json FROM pending_channel_approvals WHERE messaging_group_id = ?')
      .get(id) as { title: string; options_json: string } | undefined;
    if (c?.title) return { title: c.title, options: JSON.parse(c.options_json) };
  }

  if (hasTable(getDb(), 'pending_sender_approvals')) {
    const s = getDb().prepare('SELECT title, options_json FROM pending_sender_approvals WHERE id = ?').get(id) as
      | { title: string; options_json: string }
      | undefined;
    if (s?.title) return { title: s.title, options: JSON.parse(s.options_json) };
  }

  return undefined;
}
