/**
 * Plan and apply a change of an existing agent group's coworker type.
 *
 * A group's type decides what the host derives for it at every spawn: the
 * composed CLAUDE.md, the MCP servers and overlays of the type manifest, and the
 * skill scope group-init mirrors into `.claude-shared/skills`. Group-init also
 * prunes every mirrored catalog skill the scope no longer claims, so changing
 * the type removes skills from a live group. That is why the type is set at
 * create and why `restamp` refuses to change it implicitly: it has to be a
 * deliberate operator step that shows its effect first.
 *
 * Consider prod's `slang_maintainer`, created as `slang-writer` although its job
 * is the maintainer sweep. A switch to `slang-maintainer` swaps the writer's
 * worktree and draft-PR workflows for `/slang-maintain`, adds the `no-push`
 * invariant, and mirrors `slang-maintainer-tools` and `slang-pr-report` instead
 * of `slang-code-writer`. The plan below names each of those changes, and the
 * apply step only writes the column: the derived surfaces follow at the next
 * spawn, which the CLI forces by restarting the group's running containers.
 *
 * What the switch never touches: the group's explicit MCP allow-list (an
 * explicit list is the only state that restricts, so the switch must not reset
 * it), its standing instructions (`instructions.prepend.md`), its memory and
 * workspace, plugin-owned skills (group-init never prunes them), and sessions.
 */
import fs from 'fs';
import path from 'path';

import { readCoworkerTypes, readSkillCatalog, resolveCoworkerManifest } from './claude-composer.js';
import type { CoworkerTypeEntry } from './claude-composer/types.js';
import { isImmortalGroup } from './container-config.js';
import { isContainerRunning, renderComposedDocument } from './container-runner.js';
import { getSessionsByAgentGroup } from './db/sessions.js';
import { sessionDir } from './session-manager.js';
import { isBusyContainer } from './spawn-admission.js';
import { coworkerTypeRefusal } from './templates/coworker-type.js';
import type { AgentGroup } from './types.js';

/** Names added and removed between the current and the proposed type. */
export interface NameDelta {
  added: string[];
  removed: string[];
}

/** What a coworker-type switch would change, and anything that blocks it now. */
export interface CoworkerTypeSwitchPlan {
  agent_group_id: string;
  folder: string;
  from: string | null;
  to: string;
  project: { from: string | null; to: string | null };
  skills: NameDelta;
  workflows: NameDelta;
  invariants: NameDelta;
  overlays: NameDelta;
  mcp_servers: NameDelta;
  document: {
    from_title: string | null;
    to_title: string | null;
    from_bytes: number | null;
    to_bytes: number;
    from_hash: string | null;
    to_hash: string;
    headings_added: string[];
    headings_removed: string[];
    /** Set when the current type no longer composes; the switch can still proceed. */
    from_error?: string;
  };
  allow_list: { state: 'explicit' | 'inherit' | 'unrestricted'; unchanged: true };
  /** Sessions whose running container the apply step restarts. */
  running_sessions: string[];
  /** Running sessions inside a turn right now; any one blocks the apply step. */
  busy_sessions: string[];
  blockers: string[];
}

/** Return the sorted names in `next` but not `prev`, and in `prev` but not `next`. */
function delta(prev: Iterable<string>, next: Iterable<string>): NameDelta {
  const a = new Set(prev);
  const b = new Set(next);
  return {
    added: [...b].filter((x) => !a.has(x)).sort(),
    removed: [...a].filter((x) => !b.has(x)).sort(),
  };
}

/**
 * Return the project a type belongs to, following `extends` until one declares
 * it; a compound `a+b` type joins its parts' projects. Returns null for a type
 * with no project anywhere in its chain.
 */
export function typeProject(types: Record<string, CoworkerTypeEntry>, type: string): string | null {
  const projects = new Set<string>();
  const visit = (name: string, seen: Set<string>): void => {
    if (seen.has(name)) return;
    seen.add(name);
    const entry = types[name];
    if (!entry) return;
    if (entry.project) {
      projects.add(entry.project);
      return;
    }
    const parents = entry.extends === undefined ? [] : Array.isArray(entry.extends) ? entry.extends : [entry.extends];
    for (const parent of parents) visit(parent, seen);
  };
  for (const part of type.split('+')) visit(part.trim(), new Set());
  return projects.size === 0 ? null : [...projects].sort().join('+');
}

/**
 * Return a one-line label for an invariant: the manifest carries each
 * invariant's resolved text, so the plan names it by its first non-empty line,
 * without a leading heading marker, cut to 80 characters.
 */
function invariantLabel(text: string): string {
  const line = text.split('\n').find((l) => l.trim()) ?? '';
  const label = line.replace(/^#+\s*/, '').trim();
  return label.length > 80 ? `${label.slice(0, 77)}...` : label;
}

/** Return the composed document's `# ` title line, without the marker. */
function documentTitle(content: string): string | null {
  const line = content.split('\n').find((l) => /^# \S/.test(l));
  return line ? line.slice(2).trim() : null;
}

/** Return the `#`/`##`/`###` headings of a composed document. */
function documentHeadings(content: string): string[] {
  return content
    .split('\n')
    .filter((l) => /^#{1,3} \S/.test(l))
    .map((l) => l.trim());
}

/** Return the allow-list state a group's stored column means; see `mcp-allowlist.ts`. */
function allowListState(group: AgentGroup): 'explicit' | 'inherit' | 'unrestricted' {
  const stored = group.allowed_mcp_tools;
  if (stored === null || stored === undefined) return 'inherit';
  return stored.trim() === '*' || stored.trim() === '"*"' ? 'unrestricted' : 'explicit';
}

/**
 * Return the group's sessions with a running container, and those of them
 * inside a turn: a heartbeat within the busy window, the same test the
 * busy-container limit uses. Restarting a session mid-turn cuts that turn off,
 * so the apply step waits for it.
 */
function liveSessions(
  group: AgentGroup,
  sessions: Awaited<ReturnType<typeof getSessionsByAgentGroup>>,
  nowMs: number,
): { running: string[]; busy: string[] } {
  const running: string[] = [];
  const busy: string[] = [];
  for (const s of sessions) {
    if (s.status !== 'active' || !isContainerRunning(s.id)) continue;
    running.push(s.id);
    let heartbeatMs = 0;
    try {
      heartbeatMs = fs.statSync(path.join(sessionDir(group.id, s.id), '.heartbeat')).mtimeMs;
    } catch {
      heartbeatMs = 0;
    }
    if (heartbeatMs > 0 && isBusyContainer({ startedAtMs: 0, adopted: true, heartbeatMs }, nowMs)) busy.push(s.id);
  }
  return { running, busy };
}

/**
 * Build the plan for switching `group` to coworker type `to`, or throw when the
 * switch is never allowed: an admin or immortal group, the type it already has,
 * a type that grants immortality, does not resolve or composes flat (the same
 * rules a new group's type must pass), or a type of another project.
 * Conditions that can clear by themselves, such as a session inside a turn, are
 * returned as `blockers` instead.
 */
export async function planCoworkerTypeSwitch(
  group: AgentGroup,
  to: string,
  opts: { projectRoot?: string; nowMs?: number } = {},
): Promise<CoworkerTypeSwitchPlan> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const target = to.trim();
  if (!target) throw new Error('a coworker type is required (an existing group cannot be made untyped)');
  if (isImmortalGroup(group)) {
    throw new Error(`group '${group.folder}' is an admin or immortal group; its coworker type is not switchable`);
  }
  if ((group.coworker_type ?? null) === target) {
    throw new Error(`group '${group.folder}' already has coworker type "${target}"; nothing to change`);
  }
  const refusal = coworkerTypeRefusal(projectRoot, target);
  if (refusal) throw new Error(refusal);

  const types = readCoworkerTypes(projectRoot);
  const catalog = readSkillCatalog(projectRoot);
  const fromProject = group.coworker_type ? typeProject(types, group.coworker_type) : null;
  const toProject = typeProject(types, target);
  if (fromProject && toProject && fromProject !== toProject) {
    throw new Error(
      `coworker type "${target}" belongs to project "${toProject}", but group '${group.folder}' is a ` +
        `"${fromProject}" coworker; a switch stays within one project`,
    );
  }

  const fromManifest = resolveCoworkerManifest(types, group.coworker_type || 'default', catalog, projectRoot, {
    cliScope: 'group',
  });
  const toManifest = resolveCoworkerManifest(types, target, catalog, projectRoot, { cliScope: 'group' });
  const overlaysOf = (m: typeof toManifest) =>
    m.customizations.filter((c) => c.kind === 'overlay' && c.overlayName).map((c) => c.overlayName!);

  const proposed = await renderComposedDocument({ ...group, coworker_type: target });
  let current: { content: string; hash: string } | null = null;
  let fromError: string | undefined;
  try {
    current = await renderComposedDocument(group);
  } catch (err) {
    fromError = err instanceof Error ? err.message : String(err);
  }
  const headings = delta(current ? documentHeadings(current.content) : [], documentHeadings(proposed.content));

  const sessions = await getSessionsByAgentGroup(group.id);
  const live = liveSessions(group, sessions, opts.nowMs ?? Date.now());
  const blockers = live.busy.map(
    (id) => `session ${id} is inside a turn (heartbeat within the last 2 minutes); retry once it is idle`,
  );

  return {
    agent_group_id: group.id,
    folder: group.folder,
    from: group.coworker_type ?? null,
    to: target,
    project: { from: fromProject, to: toProject },
    skills: delta(
      fromManifest.skills.map((s) => s.name),
      toManifest.skills.map((s) => s.name),
    ),
    workflows: delta(
      fromManifest.workflows.map((w) => w.name),
      toManifest.workflows.map((w) => w.name),
    ),
    invariants: delta(fromManifest.invariants.map(invariantLabel), toManifest.invariants.map(invariantLabel)),
    overlays: delta(overlaysOf(fromManifest), overlaysOf(toManifest)),
    mcp_servers: delta(Object.keys(fromManifest.mcpServers ?? {}), Object.keys(toManifest.mcpServers ?? {})),
    document: {
      from_title: current ? documentTitle(current.content) : null,
      to_title: documentTitle(proposed.content),
      from_bytes: current ? Buffer.byteLength(current.content) : null,
      to_bytes: Buffer.byteLength(proposed.content),
      from_hash: current ? current.hash : null,
      to_hash: proposed.hash,
      headings_added: headings.added,
      headings_removed: headings.removed,
      ...(fromError ? { from_error: fromError } : {}),
    },
    allow_list: { state: allowListState(group), unchanged: true },
    running_sessions: live.running,
    busy_sessions: live.busy,
    blockers,
  };
}

/** Render a plan as the lines `ncl` prints for a human. */
export function formatCoworkerTypeSwitchPlan(plan: CoworkerTypeSwitchPlan): string[] {
  const names = (d: NameDelta) => {
    const parts = [...d.added.map((n) => `+${n}`), ...d.removed.map((n) => `-${n}`)];
    return parts.length > 0 ? parts.join(' ') : '(no change)';
  };
  const doc = plan.document;
  const lines = [
    `Coworker type for '${plan.folder}': ${plan.from ?? 'untyped'} -> ${plan.to}` +
      (plan.project.to ? ` (project ${plan.project.to})` : ''),
    `  skills:      ${names(plan.skills)}`,
    `  workflows:   ${names(plan.workflows)}`,
    `  invariants:  ${names(plan.invariants)}`,
    `  overlays:    ${names(plan.overlays)}`,
    `  mcp servers: ${names(plan.mcp_servers)}`,
    `  CLAUDE.md:   "${doc.from_title ?? '?'}" (${doc.from_bytes ?? '?'} bytes) -> "${doc.to_title ?? '?'}" (${doc.to_bytes} bytes)`,
  ];
  if (doc.from_error) lines.push(`               the current type does not compose: ${doc.from_error}`);
  for (const h of doc.headings_added) lines.push(`               + ${h}`);
  for (const h of doc.headings_removed) lines.push(`               - ${h}`);
  lines.push(
    `  MCP allow-list: ${plan.allow_list.state}, unchanged by the switch`,
    `  running containers restarted on apply: ${plan.running_sessions.length > 0 ? plan.running_sessions.join(', ') : 'none'}`,
  );
  for (const b of plan.blockers) lines.push(`  BLOCKED: ${b}`);
  return lines;
}
