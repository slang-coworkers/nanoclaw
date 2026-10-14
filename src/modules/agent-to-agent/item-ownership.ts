/**
 * One owner per GitHub work item — the lookup behind a2a.send's item refusal.
 *
 * A session's cost cap is per SESSION, and a session is keyed by (agent group,
 * messaging group, thread_id). Any never-used thread_id therefore mints a fresh
 * session with a fresh budget and none of the existing context. Sub-threads of a
 * canonical GitHub thread (`gh-issue-<owner>/<repo>-<n>/<sub-task>`) are a
 * documented, legitimate form, but they were also used to route work AROUND a
 * budget-exhausted owner session (shader-slang/slang#13406 → `…-11709/13406-resume`,
 * #12714 → `…/round-up-flag` "to mint a fresh funded session", #12581). This
 * module answers one question for the guard: would this a2a delivery create a
 * SECOND live session in the recipient group for an item that group already
 * owns? If so, a2a.send refuses it: raise the owner's ceiling or don't run.
 *
 * Pure parse + read-only DB lookups; no writes.
 */
import { getDb } from '../../db/connection.js';
import { findSessionByAgentThread, getSession } from '../../db/sessions.js';
import type { Session } from '../../types.js';

/** A GitHub issue or PR, kind-agnostic (a PR number is an issue number too). */
export interface GhWorkItem {
  owner: string;
  repo: string;
  number: number;
  /** `<owner>/<repo>#<n>` — stable display/compare key. */
  key: string;
}

const GH_THREAD = /^gh-(?:issue|pr)-([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/(.+)$/;
// Within the first path segment after the owner: the repo is the shortest
// prefix followed by `-<digits>` where the digits end the segment or are
// followed by `-<non-digit>` (a dash suffix such as `-supersede`). The lookahead
// keeps a repo whose name itself has a numeric dash-segment (`foo-2-123`) whole.
const REPO_AND_NUMBER = /^([A-Za-z0-9._-]+?)-(\d+)(?=$|-(?!\d))/;

/**
 * Parse a thread id into its canonical GitHub item. Accepts the canonical form
 * (`gh-issue-shader-slang/slang-11709`, `gh-pr-shader-slang/slang-13406`) and
 * both sub-thread forms seen in prod: `/…` (`…-11709/13406-resume`) and the
 * rarer dash suffix (`gh-issue-shader-slang/slang-12231-supersede`). Returns
 * null for anything that is not a GitHub thread.
 */
export function parseGhWorkItem(threadId: string | null | undefined): GhWorkItem | null {
  if (!threadId) return null;
  const m = GH_THREAD.exec(threadId.trim());
  if (!m) return null;
  const owner = m[1];
  const firstSegment = m[2].split('/')[0];
  const rn = REPO_AND_NUMBER.exec(firstSegment);
  if (!rn) return null;
  const repo = rn[1];
  const number = Number(rn[2]);
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  return { owner, repo, number, key: `${owner}/${repo}#${number}` };
}

export interface ItemOwnerConflict {
  item: GhWorkItem;
  /** The thread the new session would be created on. */
  requestedThread: string;
  /** Live sessions in the recipient group that already own the item, oldest first. */
  owners: Session[];
}

function likePrefix(prefix: string): string {
  return prefix.replace(/[\\%_]/g, (c) => `\\${c}`) + '%';
}

/**
 * Would delivering into `targetAgentGroupId` on `threadId` create a second live
 * session for a GitHub item the group already owns?
 *
 * - Not a GitHub thread → null (exempt).
 * - An active session of the group already sits on EXACTLY this thread → null:
 *   resolveSession's canonical collapse reuses it, nothing is created.
 * - Otherwise the owners are the group's active sessions whose thread parses to
 *   the same item (canonical thread or any sub-thread, issue or PR kind), plus
 *   the session pr_session_mappings names for the item when it belongs to this
 *   group. Closed sessions never count. No owners → null.
 */
export async function findItemOwnerConflict(
  targetAgentGroupId: string,
  threadId: string | null | undefined,
): Promise<ItemOwnerConflict | null> {
  const item = parseGhWorkItem(threadId);
  if (!item || !threadId) return null;
  const requestedThread = threadId.trim();

  if (await findSessionByAgentThread(targetAgentGroupId, requestedThread)) return null;

  const db = getDb();
  const owners = new Map<string, Session>();
  for (const kind of ['issue', 'pr'] as const) {
    const rows = await db.all<Session>(
      `SELECT * FROM sessions
         WHERE agent_group_id = ? AND status = 'active' AND thread_id LIKE ? ESCAPE '\\'
         ORDER BY created_at ASC, id ASC`,
      targetAgentGroupId,
      likePrefix(`gh-${kind}-${item.owner}/${item.repo}-${item.number}`),
    );
    for (const s of rows) {
      const parsed = parseGhWorkItem(s.thread_id);
      if (parsed && parsed.key === item.key && s.thread_id !== requestedThread) owners.set(s.id, s);
    }
  }

  // A PR's owner is whoever pr_session_mappings names (first-claim-wins), even
  // when that session's own thread is a different item (a fixer on the issue
  // thread owns the PR it opened).
  try {
    const mapped = await db.get<{ session_id: string; agent_group_id: string }>(
      'SELECT session_id, agent_group_id FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
      `${item.owner}/${item.repo}`,
      item.number,
    );
    if (mapped && mapped.agent_group_id === targetAgentGroupId && !owners.has(mapped.session_id)) {
      const s = await getSession(mapped.session_id);
      if (s && s.status === 'active' && s.agent_group_id === targetAgentGroupId && s.thread_id !== requestedThread) {
        owners.set(s.id, s);
      }
    }
  } catch {
    /* pr_session_mappings absent (module not installed / pre-migration) — sessions alone decide */
  }

  if (owners.size === 0) return null;
  const sorted = [...owners.values()].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  return { item, requestedThread, owners: sorted };
}
