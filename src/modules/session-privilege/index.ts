/**
 * Session privilege. Every session is either open (open-weights models only)
 * or closed (closed models allowed), and it keeps that privilege for its whole
 * life. A message goes to the session of its sender's privilege on its thread;
 * when that session does not exist yet, routing creates it. One thread can so
 * hold an open and a closed session side by side, and no session ever mixes
 * the two. See docs/session-privilege.md.
 *
 * Consider a GitHub issue where a maintainer on the approved list asks the
 * fixer for a patch, and later a contributor who is not on the list comments
 * on the same issue. The maintainer's comment starts a closed session. The
 * contributor's comment does not enter that session: it starts an open session
 * of the same fixer on the same thread, which runs on open-weights models.
 *
 * Settings are read from .env / the environment on each call:
 *   NANOCLAW_SESSION_PRIVILEGE      off (default) | enforce
 *   NANOCLAW_CLOSED_MODEL_APPROVED  path to the approved list (default
 *                                   data/closed-model-approved.json)
 *
 * With the setting off, every message asks for an open session, every session
 * is open, and spawn ignores the privilege, so the install behaves as before.
 */
import fs from 'fs';
import path from 'path';

import { readEnvFile } from '../../env.js';
import type { ModelPolicyRow } from '../../model-policy.js';

export type SessionPrivilege = 'open' | 'closed';

const KEYS = ['NANOCLAW_SESSION_PRIVILEGE', 'NANOCLAW_CLOSED_MODEL_APPROVED'];

export interface PrivilegeSettings {
  mode: 'off' | 'enforce';
  approvedPath: string;
}

export function readPrivilegeSettings(): PrivilegeSettings {
  const file = readEnvFile(KEYS);
  const val = (k: string) => (process.env[k] || file[k] || '').trim();
  return {
    mode: val('NANOCLAW_SESSION_PRIVILEGE').toLowerCase() === 'enforce' ? 'enforce' : 'off',
    approvedPath: path.resolve(val('NANOCLAW_CLOSED_MODEL_APPROVED') || 'data/closed-model-approved.json'),
  };
}

/**
 * Load the approved list: a JSON array of namespaced user ids, the same ids the
 * permissions module stores (`slack:U012AB3CD`, `discord:80351110224678912`),
 * plus `github:<numeric id>` for GitHub accounts. GitHub entries use the numeric
 * id because a login can be renamed or reused. The operator keeps this file; it
 * stands in for the closed-model eligibility check until that check has its
 * identity sources. A missing or unreadable file is an empty list, so nobody
 * gets a closed session by accident.
 */
export function loadApproved(approvedPath: string): Set<string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(approvedPath, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && /^[a-z-]+:\S+$/.test(id)));
    // eslint-disable-next-line no-catch-all/no-catch-all -- a missing or malformed list is an empty list
  } catch {
    return new Set();
  }
}

/**
 * The privilege a message from `userId` asks for: closed when enforcement is
 * on and the sender is on the approved list, open otherwise. A message with no
 * known sender (a system event, a CI result) is open.
 */
export function privilegeForSender(
  userId: string | null,
  settings: PrivilegeSettings = readPrivilegeSettings(),
): SessionPrivilege {
  if (settings.mode !== 'enforce' || !userId) return 'open';
  return loadApproved(settings.approvedPath).has(userId) ? 'closed' : 'open';
}

/**
 * The privilege a GitHub delivery asks for, from the account that triggered it
 * (`payload.sender`). A person on the approved list asks for `closed`, any other
 * person for `open`. An automated sender (a bot or an app: CI, the review
 * bots, this install's own bot) has no person behind it, so it asks for
 * nothing and its event follows the session that already exists.
 */
export function privilegeForGitHubSender(
  payload: Record<string, unknown>,
  settings: PrivilegeSettings = readPrivilegeSettings(),
): SessionPrivilege | undefined {
  const sender = payload.sender as { id?: unknown; type?: unknown } | undefined;
  if (sender?.type === 'Bot') return undefined;
  const id = typeof sender?.id === 'number' && Number.isInteger(sender.id) ? sender.id : null;
  return privilegeForSender(id === null ? null : `github:${id}`, settings);
}

/** A session's privilege; rows from before the column existed count as open. */
export function sessionPrivilegeOf(session: { privilege?: SessionPrivilege | null }): SessionPrivilege {
  return session.privilege === 'closed' ? 'closed' : 'open';
}

/**
 * Whether `source` may write into `target`. An open session must not write into
 * a closed one: a person who is not approved would then direct a closed model
 * through the open session. A closed session may write into an open one, because
 * the open session only reads the closed model's output, as the public thread
 * already does.
 */
export function mayDeliverInto(
  source: { privilege?: SessionPrivilege | null },
  target: { privilege?: SessionPrivilege | null },
): boolean {
  return !(sessionPrivilegeOf(source) === 'open' && sessionPrivilegeOf(target) === 'closed');
}

/** True when spawn applies the session's privilege to the group's models. */
export function privilegeEnforced(settings: PrivilegeSettings = readPrivilegeSettings()): boolean {
  return settings.mode === 'enforce';
}

/**
 * The model settings a session runs with: the group's row, adjusted for the
 * session's privilege. An open session runs under `weights=open`, so spawn
 * refuses to start it on a closed model. A closed session runs without the
 * rule, so the group's models and the install defaults apply, and a group set
 * to `weights=open` for its open sessions can still run closed models for its
 * approved people. With enforcement off, the row is the group's own, as before.
 */
export function rowForPrivilege(
  row: ModelPolicyRow,
  privilege: SessionPrivilege,
  settings: PrivilegeSettings = readPrivilegeSettings(),
): ModelPolicyRow {
  if (settings.mode !== 'enforce') return row;
  return { ...row, weights: privilege === 'open' ? 'open' : null };
}
