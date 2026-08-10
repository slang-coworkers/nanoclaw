/**
 * The ONE resolver for an agent group's MCP tool allow-list.
 *
 * `ncl groups mcp-tools get`, `ncl groups mcp-tools set`, the live re-scope of
 * a running container, and container spawn all read the policy from here.
 * They used to answer the same question three different ways:
 *
 *   - `get` reported a DB NULL as "unrestricted" and listed nothing as blocked;
 *   - spawn resolved a non-admin NULL to the coworker-type manifest — a
 *     RESTRICTED set, so the operator display was wrong for every default group;
 *   - spawn gave an admin group every discovered tool and IGNORED an explicit
 *     DB list, so an admin restriction silently evaporated on the next respawn.
 *
 * The root cause was one storage value (`agent_groups.allowed_mcp_tools IS
 * NULL`) standing for two different intentions. They are now distinct states:
 *
 * | stored value        | state          | effective tools                     |
 * |---------------------|----------------|-------------------------------------|
 * | `NULL`              | `inherited`    | coworker-type manifest (or, for an  |
 * |                     |                | admin group, every discovered tool) |
 * | `*`                 | `unrestricted` | every discovered tool               |
 * | `["mcp__a__b", …]`  | `explicit`     | exactly that list                   |
 *
 * `explicit` always wins — for admin groups too. `is_admin` only decides what
 * `inherited` means.
 *
 * ## Policy state is NOT list length
 *
 * A fourth state, `unresolved`, exists because "the list is empty" and "we
 * could not work out what the list is" are different facts with opposite safe
 * behaviours. Before this distinction existed, both arrived at the enforcement
 * layer as `tools.length === 0`, and every layer read that as "no restrictions
 * to install" — so `--tools '[]'` ("allow no MCP tools") and a broken coworker
 * registry both produced a container with EVERY direct MCP namespace
 * wildcard-allowed, including the built-in `nanoclaw` server and `codex`.
 *
 * The states now drive enforcement directly (see `buildMcpPolicy`):
 *
 * | state          | meaning                        | enforcement                    |
 * |----------------|--------------------------------|--------------------------------|
 * | `unrestricted` | every discovered tool          | no MCP restrictions installed  |
 * | `explicit`     | exactly the stored list        | deny everything not listed     |
 * | `inherited`    | the resolved manifest          | deny everything not listed     |
 * | `unresolved`   | the list could NOT be computed | deny ALL configurable MCP      |
 *
 * `explicit` and `inherited` with an empty set are perfectly valid and mean
 * "deny every configurable MCP tool" — they are NOT the same as `unresolved`,
 * which additionally signals an operator-visible configuration fault.
 */
import { readCoworkerTypes, readSkillCatalog, resolveCoworkerManifest } from './claude-composer.js';
import { log } from './log.js';
import { getDiscoveredToolInventory } from './mcp-auth-proxy.js';
import type { AgentGroup } from './types.js';

/** Stored form of "unrestricted". Also accepted: `"*"` and `["*"]`. */
export const UNRESTRICTED = '*';

export type McpAllowlistState = 'explicit' | 'inherited' | 'unrestricted' | 'unresolved';

/**
 * The message-transport floor: built-in MCP tools that sit OUTSIDE the
 * user-configurable allow-list and are always callable.
 *
 * This boundary is drawn in code, not prose, because a mute agent is not a
 * safe agent — it is an agent that cannot report that it has been muted. In
 * task sessions the runner delivers NOTHING on its own: `poll-loop.ts` routes
 * a task's output only through `send_message`, so denying it does not restrict
 * a capability, it deletes the session's only exit. The same is true for a
 * restart triggered by a policy narrowing: the respawned container has to be
 * able to say what happened.
 *
 * Scope is deliberately minimal — the OUTBOUND transport surface, nothing
 * else. `ask_user_question`, `send_card`, `install_packages`, `create_agent`,
 * `record_decision` and friends are all configurable and are denied by an
 * empty list. `ncl` is not on this list because it is not an MCP tool at all:
 * it is a CLI reached over Bash whose every command is separately gated by
 * `cli_scope` and the guard at `src/cli/dispatch.ts`.
 *
 * MUST stay identical to `MANDATORY_MCP_TOOLS` in
 * `container/agent-runner/src/mcp-policy.ts` (separate runtime, no shared
 * modules). `src/mcp-policy-parity.test.ts` fails the build if they drift.
 */
export const MANDATORY_MCP_TOOLS: readonly string[] = [
  'mcp__nanoclaw__send_message',
  'mcp__nanoclaw__send_file',
  'mcp__nanoclaw__add_reaction',
];

/**
 * Host-side delivery actions that ARE built-in `nanoclaw` MCP tools, mapped to
 * the tool name the allow-list speaks in. The names differ in one case
 * (`report_pr_created` writes action `map_pr_session`), so the mapping is
 * explicit rather than derived — a silent mismatch here would be a hole.
 *
 * This is what makes the built-in surface enforceable on the HOST. Every other
 * container-side check can be edited by the agent (per-group `/app/src` is a
 * writable mount); `handleSystemAction` cannot be.
 *
 * Actions deliberately absent:
 *   - `cli_request` — the `ncl` bridge, not an MCP tool (see above).
 *   - `record_human_verdict` — arrives from the GitHub webhook path, not from
 *     an agent tool call, so it has no allow-list identity.
 */
export const NANOCLAW_ACTION_TOOLS: Readonly<Record<string, string>> = {
  create_agent: 'mcp__nanoclaw__create_agent',
  wire_agents: 'mcp__nanoclaw__wire_agents',
  map_pr_session: 'mcp__nanoclaw__report_pr_created',
  record_decision: 'mcp__nanoclaw__record_decision',
  append_learning: 'mcp__nanoclaw__append_learning',
  install_packages: 'mcp__nanoclaw__install_packages',
  add_mcp_server: 'mcp__nanoclaw__add_mcp_server',
  request_restart: 'mcp__nanoclaw__request_restart',
};

export interface McpAllowlistResolution {
  /**
   * Where the effective list came from. `inherited` and `unrestricted` are
   * deliberately separate: both used to be stored as NULL, which is what let
   * the read path and the spawn path disagree. `unresolved` means the question
   * could not be answered at all — never treat it as an empty list.
   */
  state: McpAllowlistState;
  /** The effective, configurable tool list. Empty is a real answer. */
  tools: string[];
  /**
   * What the runtime actually permits: `tools` plus the mandatory transport
   * floor. Enforcement reads THIS; `tools` is the operator-facing policy.
   */
  enforcedTools: string[];
  /** Discovered tools NOT permitted — what the group actually cannot call. */
  blocked: string[];
  /** One-line origin, for `get` output, approval cards and logs. */
  origin: string;
}

/** The fields of an agent group this policy reads. */
export type AllowlistGroup = Pick<AgentGroup, 'allowed_mcp_tools' | 'is_admin' | 'coworker_type'>;

/**
 * Every discovered tool across every wired MCP server, SDK-prefixed.
 *
 * Returns `null` — not `[]` — when the inventory cannot be read. An empty
 * inventory ("no proxied servers are up") and an unreadable one ("we don't
 * know what exists") must not collapse into the same value: the second one
 * means no deny list derived from it can be proven complete.
 */
function discoveredTools(): string[] | null {
  try {
    return Object.values(getDiscoveredToolInventory()).flat();
  } catch (err) {
    log.warn('MCP tool inventory unreadable', { err });
    return null;
  }
}

/**
 * Tools a group inherits from its coworker type. The spawn path already
 * resolves this manifest (behind a fingerprint cache) and passes it in;
 * operator commands let this resolve it directly, which is the same
 * computation off the same registry.
 *
 * Returns `null` when the registry cannot be resolved. It used to return `[]`,
 * which downstream read as "this coworker type grants no MCP tools" — a
 * broken registry silently became a policy, and because an empty policy was
 * itself treated as "install no restrictions", it became NO policy.
 */
function manifestTools(group: AllowlistGroup): string[] | null {
  const effectiveType = group.coworker_type || 'default';
  try {
    const projectRoot = process.cwd();
    const manifest = resolveCoworkerManifest(
      readCoworkerTypes(projectRoot),
      effectiveType,
      readSkillCatalog(projectRoot),
      projectRoot,
    );
    return manifest.tools.filter((t) => t.startsWith('mcp__'));
  } catch (err) {
    log.warn('Failed to resolve coworker manifest for MCP allow-list', { coworkerType: effectiveType, err });
    return null;
  }
}

/**
 * Parse the stored column into an intention.
 *
 * Tolerates the two legacy shapes the runtime already accepted: a JSON array,
 * and a bare comma-separated list.
 */
export function parseStoredAllowlist(stored: string | null | undefined): string[] | 'unrestricted' | null {
  const raw = (stored ?? '').trim();
  if (!raw) return null;
  if (raw === UNRESTRICTED || raw === `"${UNRESTRICTED}"` || raw === `["${UNRESTRICTED}"]`) return 'unrestricted';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const tools = parsed.map(String).filter(Boolean);
      // A single-element `*` array is the sentinel, not a tool named `*`.
      if (tools.length === 1 && tools[0] === UNRESTRICTED) return 'unrestricted';
      return tools;
    }
  } catch {
    /* not JSON — fall through to the legacy comma-separated form */
  }
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Resolve a group's effective MCP tool allow-list.
 *
 * @param inheritedTools Pre-resolved coworker-type manifest tools, when the
 * caller already has them (spawn resolves the manifest anyway, behind a cache).
 * Omit and they are resolved here.
 */
export function resolveMcpAllowlist(group: AllowlistGroup, inheritedTools?: string[]): McpAllowlistResolution {
  const inventory = discoveredTools();

  const resolution = (state: McpAllowlistState, tools: string[], origin: string): McpAllowlistResolution => {
    const enforcedTools = state === 'unrestricted' ? tools : [...new Set([...tools, ...MANDATORY_MCP_TOOLS])].sort();
    const permitted = new Set(enforcedTools);
    return {
      state,
      tools,
      enforcedTools,
      // An unreadable inventory can't produce a complete blocked list; say so
      // by returning nothing rather than an authoritative-looking short one.
      blocked: state === 'unrestricted' ? [] : (inventory ?? []).filter((t) => !permitted.has(t)),
      origin,
    };
  };

  const stored = parseStoredAllowlist(group.allowed_mcp_tools);

  // An explicit list wins for EVERY group, admin included. Admin used to skip
  // this branch entirely, so an admin group's restriction survived until the
  // container respawned and then silently vanished.
  //
  // An empty array is an ANSWER, not an absence: "this group may call no
  // configurable MCP tool". It resolves to `explicit`, and enforcement denies
  // every direct and proxied surface.
  if (Array.isArray(stored)) {
    return resolution('explicit', stored, 'explicit allow-list on the agent group');
  }
  if (stored === 'unrestricted') {
    if (inventory === null) {
      return resolution('unresolved', [], 'unrestricted requested, but the MCP tool inventory is unreadable');
    }
    return resolution('unrestricted', inventory, 'explicitly unrestricted');
  }

  // Nothing stored → inherited. What that inherits from depends on the group.
  if (group.is_admin) {
    const adminOverride = (process.env.ADMIN_MCP_TOOLS || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (adminOverride.length > 0) {
      return resolution('inherited', adminOverride, 'admin default: ADMIN_MCP_TOOLS');
    }
    if (inventory === null) {
      return resolution('unresolved', [], 'admin default requested, but the MCP tool inventory is unreadable');
    }
    return resolution('unrestricted', inventory, 'admin default: every discovered tool');
  }

  const inherited = inheritedTools ?? manifestTools(group);
  if (inherited === null) {
    return resolution(
      'unresolved',
      [],
      `coworker type "${group.coworker_type || 'default'}" manifest could not be resolved`,
    );
  }
  return resolution('inherited', inherited, `coworker type "${group.coworker_type || 'default'}" manifest`);
}

/**
 * The policy handed to a container at spawn, as the container reads it.
 *
 * This is the whole wire contract for `NANOCLAW_MCP_POLICY`. The container
 * mirrors this shape in `container/agent-runner/src/mcp-policy.ts`; a missing
 * or unparseable value is read there as `unresolved`, so a host that fails to
 * set it fails CLOSED rather than reverting to the old wildcard-everything
 * behaviour.
 */
export interface McpPolicyWire {
  state: McpAllowlistState;
  /** Everything the container may call, mandatory floor already unioned in. */
  tools: string[];
  origin: string;
}

/** Serialize a resolution into the container-facing policy. */
export function toMcpPolicyWire(resolution: McpAllowlistResolution): McpPolicyWire {
  return { state: resolution.state, tools: resolution.enforcedTools, origin: resolution.origin };
}

/**
 * Is this tool permitted under the resolved policy?
 *
 * The single predicate every host-side enforcement point calls, so "allowed"
 * means one thing. Default-deny: anything not `unrestricted` must name the
 * tool explicitly or be part of the mandatory transport floor.
 */
export function isMcpToolPermitted(resolution: McpAllowlistResolution, tool: string): boolean {
  if (resolution.state === 'unrestricted') return true;
  return resolution.enforcedTools.includes(tool);
}

/**
 * Does the policy permit any tool on this MCP server?
 *
 * Decides whether a DIRECT (non-proxied) server is handed to the container at
 * all. Server names are compared on the SDK's sanitized form — any character
 * outside [A-Za-z0-9_-] becomes '_' when the SDK builds a tool prefix — so
 * `slang-mcp` in container.json and `mcp__slang-mcp__x` in an allow-list agree.
 */
export function serverHasAllowedTools(resolution: McpAllowlistResolution, serverName: string): boolean {
  if (resolution.state === 'unrestricted') return true;
  const prefix = `mcp__${serverName.replace(/[^a-zA-Z0-9_-]/g, '_')}__`;
  return resolution.enforcedTools.some((t) => t.startsWith(prefix));
}

/**
 * Turn a `--tools` flag into the value to store.
 *
 * `inherit` / `null` means "no explicit list" — which resolves to the
 * coworker-type manifest, NOT to unrestricted. That is what the runtime has
 * always done; the flag's old "removes all restriction" wording described
 * behaviour only admin groups ever got. Ask for `unrestricted` explicitly to
 * get it.
 */
export function parseAllowlistFlag(raw: unknown): string | null {
  if (raw === undefined) {
    throw new Error("--tools is required: a JSON array, 'inherit', or 'unrestricted'");
  }
  if (raw === null || raw === 'null' || raw === 'inherit' || raw === 'inherited') return null;
  if (raw === 'unrestricted' || raw === UNRESTRICTED) return UNRESTRICTED;

  const parsed: unknown = typeof raw === 'string' ? JSON.parse(String(raw)) : raw;
  if (!Array.isArray(parsed)) {
    throw new Error("--tools must be a JSON array of tool names, 'inherit', or 'unrestricted'");
  }
  const tools = parsed.map(String);
  const bad = tools.filter((t) => !t.startsWith('mcp__'));
  if (bad.length) throw new Error(`Not MCP tool names: ${bad.join(', ')}`);
  return JSON.stringify(tools);
}
