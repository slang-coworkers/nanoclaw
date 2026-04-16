import type { PendingApproval, PendingQuestion, Session } from '../types.js';
import { getDb } from './connection.js';

// ── Sessions ──

export function createSession(session: Session): void {
  getDb()
    .prepare(
      `INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, agent_provider, status, container_status, last_active, created_at)
       VALUES (@id, @agent_group_id, @messaging_group_id, @thread_id, @agent_provider, @status, @container_status, @last_active, @created_at)`,
    )
    .run(session);
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

/** Find an active session scoped to an agent group (ignoring messaging group). */
export function findSessionByAgentGroup(agentGroupId: string): Session | undefined {
  return getDb()
    .prepare("SELECT * FROM sessions WHERE agent_group_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
    .get(agentGroupId) as Session | undefined;
}

export function getSessionsByAgentGroup(agentGroupId: string): Session[] {
  return getDb().prepare('SELECT * FROM sessions WHERE agent_group_id = ?').all(agentGroupId) as Session[];
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

export function createPendingQuestion(pq: PendingQuestion): void {
  getDb()
    .prepare(
      `INSERT INTO pending_questions (question_id, session_id, message_out_id, platform_id, channel_type, thread_id, created_at)
       VALUES (@question_id, @session_id, @message_out_id, @platform_id, @channel_type, @thread_id, @created_at)`,
    )
    .run(pq);
}

export function getPendingQuestion(questionId: string): PendingQuestion | undefined {
  return getDb().prepare('SELECT * FROM pending_questions WHERE question_id = ?').get(questionId) as
    | PendingQuestion
    | undefined;
}

export function deletePendingQuestion(questionId: string): void {
  getDb().prepare('DELETE FROM pending_questions WHERE question_id = ?').run(questionId);
}

// ── Pending Approvals ──

export function createPendingApproval(
  pa: Partial<PendingApproval> &
    Pick<PendingApproval, 'approval_id' | 'request_id' | 'action' | 'payload' | 'created_at'>,
): void {
  getDb()
    .prepare(
      `INSERT INTO pending_approvals
         (approval_id, session_id, request_id, action, payload, created_at,
          agent_group_id, channel_type, platform_id, platform_message_id, expires_at, status)
       VALUES
         (@approval_id, @session_id, @request_id, @action, @payload, @created_at,
          @agent_group_id, @channel_type, @platform_id, @platform_message_id, @expires_at, @status)`,
    )
    .run({
      session_id: null,
      agent_group_id: null,
      channel_type: null,
      platform_id: null,
      platform_message_id: null,
      expires_at: null,
      status: 'pending',
      ...pa,
    });
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

export function deletePendingApproval(approvalId: string): void {
  getDb().prepare('DELETE FROM pending_approvals WHERE approval_id = ?').run(approvalId);
}

export function getPendingApprovalsByAction(action: string): PendingApproval[] {
  return getDb().prepare('SELECT * FROM pending_approvals WHERE action = ?').all(action) as PendingApproval[];
}
