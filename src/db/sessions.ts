import type { PendingApproval, PendingQuestion, Session } from '../types.js';
import { getDb, hasTable } from './connection.js';

// ── Sessions ──

export const TASKS_SYSTEM_THREAD_ID = 'system:tasks';

export async function createSession(session: Session): Promise<void> {
  // Migration 021 guarantees display_title / title_source / title_updated_at
  // exist — runMigrations() runs at host startup before any createSession
  // call. No defensive column probe here; trust the migration.
  await getDb().run(
    `INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id,
                             display_title, title_source, title_updated_at,
                             agent_provider, status, container_status, last_active, created_at)
       VALUES (@id, @agent_group_id, @messaging_group_id, @thread_id,
               @display_title, @title_source, @title_updated_at,
               @agent_provider, @status, @container_status, @last_active, @created_at)`,
    { display_title: null, title_source: null, title_updated_at: null, ...session },
  );
}

/**
 * Update the session's display title. `source='manual'` marks it
 * operator-set so the heuristic titler won't re-derive on top of it.
 * Returns true if a row was updated (i.e. the session still exists).
 */
export async function updateSessionTitle(
  sessionId: string,
  displayTitle: string,
  source: 'auto' | 'heuristic' | 'manual',
  now: string = new Date().toISOString(),
): Promise<boolean> {
  // Never overwrite a manual title unless the new write is also manual.
  const clause =
    source === 'manual'
      ? 'WHERE id = ?'
      : "WHERE id = ? AND (display_title IS NULL OR COALESCE(title_source, '') != 'manual')";
  const res = await getDb().run(
    `UPDATE sessions SET display_title = ?, title_source = ?, title_updated_at = ? ${clause}`,
    displayTitle,
    source,
    now,
    sessionId,
  );
  return res.changes > 0;
}

export async function getSession(id: string): Promise<Session | undefined> {
  return getDb().get<Session>('SELECT * FROM sessions WHERE id = ?', id);
}

export async function findSession(messagingGroupId: string, threadId: string | null): Promise<Session | undefined> {
  if (threadId) {
    return getDb().get<Session>(
      'SELECT * FROM sessions WHERE messaging_group_id = ? AND thread_id = ? AND status = ?',
      messagingGroupId,
      threadId,
      'active',
    );
  }
  return getDb().get<Session>(
    'SELECT * FROM sessions WHERE messaging_group_id = ? AND thread_id IS NULL AND status = ?',
    messagingGroupId,
    'active',
  );
}

/**
 * Session lookup scoped to a specific agent group. Needed when multiple
 * agents are wired to the same messaging group + thread (fan-out) — the
 * plain `findSession` would return whichever agent's session happened to
 * be first and route to the wrong container.
 */
export async function findSessionForAgent(
  agentGroupId: string,
  messagingGroupId: string,
  threadId: string | null,
): Promise<Session | undefined> {
  if (threadId) {
    return getDb().get<Session>(
      "SELECT * FROM sessions WHERE agent_group_id = ? AND messaging_group_id = ? AND thread_id = ? AND status = 'active'",
      agentGroupId,
      messagingGroupId,
      threadId,
    );
  }
  return getDb().get<Session>(
    "SELECT * FROM sessions WHERE agent_group_id = ? AND messaging_group_id = ? AND thread_id IS NULL AND status = 'active'",
    agentGroupId,
    messagingGroupId,
  );
}

/** Find an active session for an agent + thread, ignoring messaging group. */
export async function findSessionByAgentThread(agentGroupId: string, threadId: string): Promise<Session | undefined> {
  return getDb().get<Session>(
    // created_at ASC picks the earliest (canonical) session for a thread; id ASC
    // is a deterministic tie-break so a created_at collision can't make the
    // canonical choice nondeterministic (the gh-issue/pr collapse in
    // resolveSession depends on a stable winner).
    "SELECT * FROM sessions WHERE agent_group_id = ? AND thread_id = ? AND status = 'active' ORDER BY created_at ASC, id ASC LIMIT 1",
    agentGroupId,
    threadId,
  );
}

/**
 * Does any active session exist for this issue's chain, keyed on its canonical
 * `gh-issue-<repo>-<num>` thread_id (any agent group)? Used by the webhook
 * comment gate to recognize "this issue is ours" — a follow-up comment on an
 * issue we're already driving is processed even without an @-mention (the live
 * chain IS the ownership signal, mirroring isOwnedPr/prMappingExists for PRs).
 * Returns false (never throws) if the sessions table is unavailable.
 */
export async function issueSessionExists(repo: string, issueNumber: number): Promise<boolean> {
  try {
    const row = await getDb().get(
      "SELECT 1 FROM sessions WHERE thread_id = ? AND status = 'active' LIMIT 1",
      `gh-issue-${repo}-${issueNumber}`,
    );
    return Boolean(row);
  } catch {
    return false;
  }
}

/** Find an active session scoped to an agent group (ignoring messaging group). */
export async function findSessionByAgentGroup(agentGroupId: string): Promise<Session | undefined> {
  return getDb().get<Session>(
    `SELECT * FROM sessions
       WHERE agent_group_id = ?
         AND status = 'active'
         AND NOT (messaging_group_id IS NULL AND thread_id IS NOT NULL AND thread_id LIKE 'system:%')
       ORDER BY created_at DESC
       LIMIT 1`,
    agentGroupId,
  );
}

export async function getSessionsByAgentGroup(agentGroupId: string): Promise<Session[]> {
  return getDb().all<Session>('SELECT * FROM sessions WHERE agent_group_id = ?', agentGroupId);
}

export async function findSystemSession(agentGroupId: string, threadId: string): Promise<Session | undefined> {
  return getDb().get<Session>(
    `SELECT * FROM sessions
       WHERE agent_group_id = ?
         AND messaging_group_id IS NULL
         AND thread_id = ?
         AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
    agentGroupId,
    threadId,
  );
}

/** Per-task session thread id for a scheduled task series. */
export function taskThreadId(seriesId: string): string {
  return `${TASKS_SYSTEM_THREAD_ID}:${seriesId}`;
}

/** True for any task session thread — a per-series one or the legacy shared one. */
export function isTaskThread(threadId: string | null): boolean {
  return threadId === TASKS_SYSTEM_THREAD_ID || (threadId?.startsWith(`${TASKS_SYSTEM_THREAD_ID}:`) ?? false);
}

/** Task sessions for a group — active by default, optionally including closed history. */
export async function findTaskSessions(agentGroupId: string, includeClosed = false): Promise<Session[]> {
  return getDb().all<Session>(
    `SELECT * FROM sessions
      WHERE agent_group_id = ?
        AND messaging_group_id IS NULL
        ${includeClosed ? '' : "AND status = 'active'"}
         AND (thread_id = ? OR thread_id LIKE ?)
       ORDER BY created_at DESC`,
    agentGroupId,
    TASKS_SYSTEM_THREAD_ID,
    `${TASKS_SYSTEM_THREAD_ID}:%`,
  );
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
export async function getActiveSessionsForGroup(agentGroupId: string): Promise<Session[]> {
  return getDb().all<Session>(
    "SELECT * FROM sessions WHERE agent_group_id = ? AND status = 'active' ORDER BY created_at DESC",
    agentGroupId,
  );
}

export async function getActiveSessions(): Promise<Session[]> {
  return getDb().all<Session>("SELECT * FROM sessions WHERE status = 'active'");
}

export async function getRunningSessions(): Promise<Session[]> {
  return getDb().all<Session>("SELECT * FROM sessions WHERE container_status IN ('running', 'idle')");
}

export async function updateSession(
  id: string,
  updates: Partial<Pick<Session, 'status' | 'container_status' | 'last_active' | 'agent_provider'>>,
): Promise<void> {
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length === 0) return;

  await getDb().run(`UPDATE sessions SET ${fields.join(', ')} WHERE id = @id`, values);
}

export async function deleteSession(id: string): Promise<void> {
  await getDb().run('DELETE FROM sessions WHERE id = ?', id);
}

// ── Pending Questions ──

/**
 * Insert a pending question row. Idempotent: when delivery fails and retries,
 * the second attempt calls this with the same question_id — without `OR
 * IGNORE` that would throw UNIQUE and prevent the retry from reaching the
 * actual send step. Returns true if a new row was inserted.
 */
export async function createPendingQuestion(pq: PendingQuestion): Promise<boolean> {
  const result = await getDb().run(
    `INSERT INTO pending_questions (question_id, session_id, message_out_id, platform_id, channel_type, thread_id, title, options_json, created_at)
       VALUES (@question_id, @session_id, @message_out_id, @platform_id, @channel_type, @thread_id, @title, @options_json, @created_at)
       ON CONFLICT (question_id) DO NOTHING`,
    {
      question_id: pq.question_id,
      session_id: pq.session_id,
      message_out_id: pq.message_out_id,
      platform_id: pq.platform_id,
      channel_type: pq.channel_type,
      thread_id: pq.thread_id,
      title: pq.title,
      options_json: JSON.stringify(pq.options),
      created_at: pq.created_at,
    },
  );
  return result.changes > 0;
}

export async function getPendingQuestion(questionId: string): Promise<PendingQuestion | undefined> {
  const row = await getDb().get<Omit<PendingQuestion, 'options'> & { options_json: string }>(
    'SELECT * FROM pending_questions WHERE question_id = ?',
    questionId,
  );
  if (!row) return undefined;
  const { options_json, ...rest } = row;
  return { ...rest, options: JSON.parse(options_json) };
}

export async function deletePendingQuestion(questionId: string): Promise<void> {
  await getDb().run('DELETE FROM pending_questions WHERE question_id = ?', questionId);
}

// ── Pending Approvals ──

/**
 * Insert a pending approval row. Idempotent for the same reason as
 * createPendingQuestion: delivery retries with the same approval_id must not
 * fail on UNIQUE before the send step gets a chance to succeed.
 */
export async function createPendingApproval(
  pa: Partial<PendingApproval> &
    Pick<
      PendingApproval,
      'approval_id' | 'request_id' | 'action' | 'payload' | 'created_at' | 'title' | 'options_json'
    >,
): Promise<boolean> {
  const result = await getDb().run(
    `INSERT INTO pending_approvals
         (approval_id, session_id, request_id, action, payload, created_at,
          agent_group_id, channel_type, platform_id, instance, platform_message_id, expires_at, status,
          title, question, options_json, approver_user_id)
       VALUES
         (@approval_id, @session_id, @request_id, @action, @payload, @created_at,
          @agent_group_id, @channel_type, @platform_id, @instance, @platform_message_id, @expires_at, @status,
          @title, @question, @options_json, @approver_user_id)
       ON CONFLICT (approval_id) DO NOTHING`,
    {
      session_id: null,
      agent_group_id: null,
      channel_type: null,
      platform_id: null,
      instance: null,
      platform_message_id: null,
      expires_at: null,
      status: 'pending',
      question: '',
      approver_user_id: null,
      ...pa,
    },
  );
  return result.changes > 0;
}

export async function getPendingApproval(approvalId: string): Promise<PendingApproval | undefined> {
  return getDb().get<PendingApproval>('SELECT * FROM pending_approvals WHERE approval_id = ?', approvalId);
}

/** Atomically claim one approval state transition. */
export async function transitionPendingApprovalStatus(
  approvalId: string,
  expected: PendingApproval['status'],
  status: PendingApproval['status'],
): Promise<boolean> {
  const result = await getDb().run(
    'UPDATE pending_approvals SET status = ? WHERE approval_id = ? AND status = ?',
    status,
    approvalId,
    expected,
  );
  return result.changes > 0;
}

export async function updatePendingApprovalDelivery(
  approvalId: string,
  updates: Pick<PendingApproval, 'channel_type' | 'platform_id' | 'platform_message_id'>,
): Promise<void> {
  await getDb().run(
    `UPDATE pending_approvals
       SET channel_type = ?, platform_id = ?, platform_message_id = ?
       WHERE approval_id = ?`,
    updates.channel_type,
    updates.platform_id,
    updates.platform_message_id,
    approvalId,
  );
}

/**
 * Park an approval in the "rejected, awaiting reason" hold: the admin clicked
 * "Reject with reason…" and we're waiting for their one-line reply. `expiresAt`
 * is the deadline after which the host sweep finalizes a plain reject (so a
 * ghosted hold never strands the requesting agent). Reuses the otherwise-unused
 * `expires_at` column on module-initiated rows.
 */
export async function markApprovalAwaitingReason(approvalId: string, expiresAt: string): Promise<boolean> {
  const result = await getDb().run(
    "UPDATE pending_approvals SET status = 'awaiting_reason', expires_at = ? WHERE approval_id = ? AND status = 'pending'",
    expiresAt,
    approvalId,
  );
  return result.changes > 0;
}

/** Awaiting-reason approvals whose reply window has elapsed — the sweep's ghost set. */
export async function getExpiredAwaitingReasonApprovals(nowIso: string): Promise<PendingApproval[]> {
  return getDb().all<PendingApproval>(
    "SELECT * FROM pending_approvals WHERE status = 'awaiting_reason' AND expires_at IS NOT NULL AND expires_at <= ?",
    nowIso,
  );
}

export async function deletePendingApproval(approvalId: string): Promise<void> {
  await getDb().run('DELETE FROM pending_approvals WHERE approval_id = ?', approvalId);
}

export async function getPendingApprovalsByAction(action: string): Promise<PendingApproval[]> {
  return getDb().all<PendingApproval>('SELECT * FROM pending_approvals WHERE action = ?', action);
}

/**
 * Resolve ask_question render metadata for any card. Approval-backed rows
 * include the original question body so the bridge can retain it when the
 * card resolves; generic pending_questions intentionally keep their existing
 * title + options shape.
 */
export async function getAskQuestionRender(id: string): Promise<
  | {
      title: string;
      question?: string;
      options: import('../channels/ask-question.js').NormalizedOption[];
    }
  | undefined
> {
  const q = await getPendingQuestion(id);
  if (q) return { title: q.title, options: q.options };
  const a = await getDb().get<{ title: string; question: string; options_json: string }>(
    'SELECT title, question, options_json FROM pending_approvals WHERE approval_id = ?',
    id,
  );
  if (a?.title) return { title: a.title, question: a.question, options: JSON.parse(a.options_json) };

  // Channel-registration + unknown-sender approvals persist the same render
  // metadata as pending_approvals — just SELECT and return.
  if (await hasTable(getDb(), 'pending_channel_approvals')) {
    const c = await getDb().get<{ title: string; question: string; options_json: string }>(
      'SELECT title, question, options_json FROM pending_channel_approvals WHERE messaging_group_id = ?',
      id,
    );
    if (c?.title) return { title: c.title, question: c.question, options: JSON.parse(c.options_json) };
  }

  if (await hasTable(getDb(), 'pending_sender_approvals')) {
    const s = await getDb().get<{ title: string; question: string; options_json: string }>(
      'SELECT title, question, options_json FROM pending_sender_approvals WHERE id = ?',
      id,
    );
    if (s?.title) return { title: s.title, question: s.question, options: JSON.parse(s.options_json) };
  }

  return undefined;
}
