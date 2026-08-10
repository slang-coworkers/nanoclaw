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
 *
 * ## Scope: EXTERNAL servers only
 *
 * "Configurable" means external MCP servers — `slang-mcp`, `deepwiki`, the
 * `codex` stdio child, anything wired through `container.json` or a coworker
 * type. NanoClaw's OWN built-in tools (`mcp__nanoclaw__*`) are **not** in
 * scope and this allow-list never restricts them.
 *
 * They are excluded because they are already governed, individually and by
 * something stronger. Every built-in with a host-side effect writes a delivery
 * action, and those carry a guard declaration that is required at registration
 * time: `install_packages`, `add_mcp_server`, `create_agent` and
 * `record_decision` are guard-held behind admin approval or a capability;
 * `wire_agents` enforces `is_admin` in its handler; the pure messaging tools
 * pass the destination ACL in `deliverMessage`. Gating them a SECOND time
 * through a per-group tool list added no authority — a coworker type that
 * grants the tool still grants it — while making an unrelated policy knob able
 * to break a group's ability to ask a question or record a decision.
 *
 * The boundary is `isBuiltinMcpTool`, not a hand-maintained floor list, so a
 * built-in added tomorrow is out of scope automatically and cannot be
 * forgotten into it.
 *
 * See `docs/mcp-allowlist.md` for the tool-by-tool gate inventory, including
 * the two built-ins whose own gates are weaker than they look.
 */
import { readCoworkerTypes, readSkillCatalog, resolveCoworkerManifest } from './claude-composer.js';
import { log } from './log.js';
import { getDiscoveredToolInventory } from './mcp-auth-proxy.js';
import type { AgentGroup } from './types.js';

/** Stored form of "unrestricted". Also accepted: `"*"` and `["*"]`. */
export const UNRESTRICTED = '*';

export type McpAllowlistState = 'explicit' | 'inherited' | 'unrestricted' | 'unresolved';

/**
 * The MCP server name NanoClaw's own built-in tools are served under.
 *
 * Mirrored as `BUILTIN_MCP_SERVER` in
 * `container/agent-runner/src/mcp-policy.ts` (separate runtimes, no shared
 * modules). `src/mcp-allowlist-scope.test.ts` fails the build if they drift.
 */
export const BUILTIN_MCP_SERVER = 'nanoclaw';

const BUILTIN_TOOL_PREFIX = `mcp__${BUILTIN_MCP_SERVER}__`;

/**
 * Is this one of NanoClaw's own tools, rather than an external server's?
 *
 * A prefix test, deliberately — not a list of tool names. The set of built-ins
 * changes whenever a module calls `registerTools`, and a list would silently
 * fall out of date in the direction that RESTRICTS a new built-in, which is
 * the failure this whole boundary exists to prevent.
 */
export function isBuiltinMcpTool(tool: string): boolean {
  return tool.startsWith(BUILTIN_TOOL_PREFIX);
}

export interface McpAllowlistResolution {
  /**
   * Where the effective list came from. `inherited` and `unrestricted` are
   * deliberately separate: both used to be stored as NULL, which is what let
   * the read path and the spawn path disagree. `unresolved` means the question
   * could not be answered at all — never treat it as an empty list.
   */
  state: McpAllowlistState;
  /**
   * The effective allow-list as stored/inherited, verbatim. Empty is a real
   * answer. May contain `mcp__nanoclaw__*` entries carried by a coworker
   * manifest; those are inert — see `externalTools`.
   */
  tools: string[];
  /**
   * What this policy actually governs: `tools` minus NanoClaw's own built-ins.
   * Enforcement reads THIS. Built-ins are out of scope entirely and are never
   * restricted, so listing one changes nothing and omitting one denies
   * nothing.
   */
  externalTools: string[];
  /** Discovered external tools NOT permitted — what the group cannot call. */
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
    // Built-ins are dropped rather than kept-and-ignored so that every
    // downstream consumer — proxy token scope, the container policy, the
    // operator display — sees one list that means exactly one thing.
    const externalTools = tools.filter((t) => !isBuiltinMcpTool(t));
    const permitted = new Set(externalTools);
    return {
      state,
      tools,
      externalTools,
      // An unreadable inventory can't produce a complete blocked list; say so
      // by returning nothing rather than an authoritative-looking short one.
      blocked:
        state === 'unrestricted' ? [] : (inventory ?? []).filter((t) => !isBuiltinMcpTool(t) && !permitted.has(t)),
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
  /** The permitted EXTERNAL tools. Built-ins are out of scope and never listed. */
  tools: string[];
  origin: string;
}

/** Serialize a resolution into the container-facing policy. */
export function toMcpPolicyWire(resolution: McpAllowlistResolution): McpPolicyWire {
  return { state: resolution.state, tools: resolution.externalTools, origin: resolution.origin };
}

/**
 * Is this tool permitted under the resolved policy?
 *
 * The single predicate every host-side enforcement point calls, so "allowed"
 * means one thing. Default-deny for external tools; NanoClaw's own built-ins
 * are outside this policy's scope and answer to their own gates.
 */
export function isMcpToolPermitted(resolution: McpAllowlistResolution, tool: string): boolean {
  if (isBuiltinMcpTool(tool)) return true;
  if (resolution.state === 'unrestricted') return true;
  return resolution.externalTools.includes(tool);
}

/**
 * Does the policy permit any tool on this MCP server?
 *
 * Decides whether a DIRECT (non-proxied) server is handed to the container at
 * all. Server names are compared on the SDK's sanitized form — any character
 * outside [A-Za-z0-9_-] becomes '_' when the SDK builds a tool prefix — so
 * `slang-mcp` in container.json and `mcp__slang-mcp__x` in an allow-list agree.
 *
 * The built-in server is always wired: it is out of scope, and it carries the
 * only path an agent has to say anything at all.
 */
export function serverHasAllowedTools(resolution: McpAllowlistResolution, serverName: string): boolean {
  if (serverName === BUILTIN_MCP_SERVER) return true;
  if (resolution.state === 'unrestricted') return true;
  const prefix = `mcp__${serverName.replace(/[^a-zA-Z0-9_-]/g, '_')}__`;
  return resolution.externalTools.some((t) => t.startsWith(prefix));
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
