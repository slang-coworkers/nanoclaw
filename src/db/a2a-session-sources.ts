/**
 * Read/write helpers for the a2a_session_sources mapping table.
 *
 * See src/db/migrations/920-a2a-session-sources.ts for schema + rationale.
 */
import { getDb } from './connection.js';
import { log } from '../log.js';

export interface A2aSessionSource {
  recipient_session_id: string;
  recipient_agent_group_id: string;
  recipient_thread_id: string | null;
  source_session_id: string;
  source_agent_group_id: string;
  source_thread_id: string | null;
  created_at: string;
}

/**
 * Upsert the source-session hint for a recipient session. Called right
 * after `resolveSession` creates/finds the recipient in `routeAgentMessage`.
 * INSERT OR REPLACE: repeated delegations into the same recipient session
 * from the same source refresh the mapping; a different source replacing
 * another indicates a misuse we surface in logs rather than silently merge.
 */
export async function recordSource(params: {
  recipientSessionId: string;
  recipientAgentGroupId: string;
  recipientThreadId: string | null;
  sourceSessionId: string;
  sourceAgentGroupId: string;
  sourceThreadId: string | null;
  now?: string;
}): Promise<void> {
  // Defense in depth: never record a self-referential lineage edge
  // (recipient === source). Such a row is a 1-cycle that corrupts the
  // ancestor walk (self-loop). The main-route caller already drops
  // self-targets before reaching here (agent-route.ts L2 self-target guard),
  // but guarding at the write helper protects any future/alternate caller and
  // keeps a2a_session_sources acyclic at the 1-cycle level.
  if (params.recipientSessionId === params.sourceSessionId) {
    log.warn('a2a recordSource: refusing self-referential lineage row', {
      session: params.recipientSessionId,
      agentGroup: params.recipientAgentGroupId,
    });
    return;
  }
  const now = params.now ?? new Date().toISOString();
  await getDb().run(
    `INSERT INTO a2a_session_sources
         (recipient_session_id, recipient_agent_group_id, recipient_thread_id,
          source_session_id, source_agent_group_id, source_thread_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(recipient_session_id) DO UPDATE SET
         recipient_agent_group_id = excluded.recipient_agent_group_id,
         recipient_thread_id      = excluded.recipient_thread_id,
         source_session_id        = excluded.source_session_id,
         source_agent_group_id    = excluded.source_agent_group_id,
         source_thread_id         = excluded.source_thread_id`,
    params.recipientSessionId,
    params.recipientAgentGroupId,
    params.recipientThreadId,
    params.sourceSessionId,
    params.sourceAgentGroupId,
    params.sourceThreadId,
    now,
  );
}

export function getSourceFor(recipientSessionId: string): Promise<A2aSessionSource | undefined> {
  return getDb().get<A2aSessionSource>(
    'SELECT * FROM a2a_session_sources WHERE recipient_session_id = ?',
    recipientSessionId,
  );
}

/** Upper bound on the ancestor walk — also caps the guard's lineage check. */
export const ANCESTOR_HOP_LIMIT = 16;

/**
 * Walk `a2a_session_sources` upward from `startSessionId`, returning the
 * closest ancestor row whose `source_agent_group_id` matches the target — or
 * null when the target is not in the session's source ancestry (peer /
 * unrelated / top-level session). Bounded by ANCESTOR_HOP_LIMIT and a visited
 * set so corrupt cycles drop instead of looping.
 *
 * This is the single source of truth for a2a lineage: the router uses it to
 * deliver a reply into the ancestor's existing session, and the a2a.send guard
 * uses it (via `isAncestorGroup`) to authorize an upward reply that has no
 * explicit destination row. Keeping ONE implementation ensures the guard's
 * authorization decision and the router's delivery target can never diverge.
 */
export async function findAncestorSource(
  startSessionId: string,
  targetAgentGroupId: string,
): Promise<A2aSessionSource | null> {
  const visited = new Set<string>([startSessionId]);
  let cursor = await getSourceFor(startSessionId);
  let hops = 0;
  while (cursor && hops < ANCESTOR_HOP_LIMIT) {
    if (cursor.source_agent_group_id === targetAgentGroupId) {
      return cursor;
    }
    if (visited.has(cursor.source_session_id)) {
      log.warn('a2a ancestor walk: cycle detected, dropping', {
        startSessionId,
        targetAgentGroupId,
        cycleAt: cursor.source_session_id,
      });
      return null;
    }
    visited.add(cursor.source_session_id);
    cursor = await getSourceFor(cursor.source_session_id);
    hops++;
  }
  return null;
}

/**
 * True when `targetAgentGroupId` is a genuine ancestor of the session chain
 * rooted at `startSessionId` — i.e. the sender is somewhere downstream of the
 * target in an a2a delegation chain. This is the lineage-authorization
 * predicate: a child may reply upward to an ancestor without an explicit
 * `agent_destinations` row, because the delegation chain itself proves reply
 * privilege. A non-ancestor target returns false → the guard falls through to
 * the strict destination-row check.
 */
export async function isAncestorGroup(startSessionId: string, targetAgentGroupId: string): Promise<boolean> {
  return (await findAncestorSource(startSessionId, targetAgentGroupId)) !== null;
}
