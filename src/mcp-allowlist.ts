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
 */
import { readCoworkerTypes, readSkillCatalog, resolveCoworkerManifest } from './claude-composer.js';
import { log } from './log.js';
import { getDiscoveredToolInventory } from './mcp-auth-proxy.js';
import type { AgentGroup } from './types.js';

/** Stored form of "unrestricted". Also accepted: `"*"` and `["*"]`. */
export const UNRESTRICTED = '*';

export type McpAllowlistState = 'explicit' | 'inherited' | 'unrestricted';

export interface McpAllowlistResolution {
  /**
   * Where the effective list came from. `inherited` and `unrestricted` are
   * deliberately separate: both used to be stored as NULL, which is what let
   * the read path and the spawn path disagree.
   */
  state: McpAllowlistState;
  /** The effective, callable tool list. */
  tools: string[];
  /** Discovered tools NOT in `tools` — what the group actually cannot call. */
  blocked: string[];
  /** One-line origin, for `get` output, approval cards and logs. */
  origin: string;
}

/** The fields of an agent group this policy reads. */
export type AllowlistGroup = Pick<AgentGroup, 'allowed_mcp_tools' | 'is_admin' | 'coworker_type'>;

/** Every discovered tool across every wired MCP server, SDK-prefixed. */
function discoveredTools(): string[] {
  return Object.values(getDiscoveredToolInventory()).flat();
}

/**
 * Tools a group inherits from its coworker type. The spawn path already
 * resolves this manifest (behind a fingerprint cache) and passes it in;
 * operator commands let this resolve it directly, which is the same
 * computation off the same registry.
 */
function manifestTools(group: AllowlistGroup): string[] {
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
    return [];
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
  const withBlocked = (state: McpAllowlistState, tools: string[], origin: string): McpAllowlistResolution => {
    const allowed = new Set(tools);
    return { state, tools, blocked: discoveredTools().filter((t) => !allowed.has(t)), origin };
  };

  const stored = parseStoredAllowlist(group.allowed_mcp_tools);

  // An explicit list wins for EVERY group, admin included. Admin used to skip
  // this branch entirely, so an admin group's restriction survived until the
  // container respawned and then silently vanished.
  if (Array.isArray(stored)) {
    return withBlocked('explicit', stored, 'explicit allow-list on the agent group');
  }
  if (stored === 'unrestricted') {
    return withBlocked('unrestricted', discoveredTools(), 'explicitly unrestricted');
  }

  // Nothing stored → inherited. What that inherits from depends on the group.
  if (group.is_admin) {
    const adminOverride = (process.env.ADMIN_MCP_TOOLS || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (adminOverride.length > 0) {
      return withBlocked('inherited', adminOverride, 'admin default: ADMIN_MCP_TOOLS');
    }
    return withBlocked('unrestricted', discoveredTools(), 'admin default: every discovered tool');
  }

  const inherited = inheritedTools ?? manifestTools(group);
  return withBlocked('inherited', inherited, `coworker type "${group.coworker_type || 'default'}" manifest`);
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
