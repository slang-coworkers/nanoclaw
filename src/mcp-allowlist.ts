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
 * ## Only an explicit list restricts
 *
 * A scope change must be something a person did on purpose. `ncl groups
 * mcp-tools set` is the only thing that narrows or widens a group; nothing
 * implicit — not a coworker-type manifest, not a registry that failed to
 * load — may change what a group can reach.
 *
 * | stored          | state          | enforcement                              |
 * |-----------------|----------------|------------------------------------------|
 * | `["mcp__a__b"]` | `explicit`     | exactly that list; everything else denied |
 * | `[]`            | `explicit`     | **every external MCP tool denied**        |
 * | `*`             | `unrestricted` | nothing denied                            |
 * | `NULL`          | `inherited`    | nothing denied — the default is today's behaviour |
 *
 * `[]` is the F03 fix and it stays: an empty list used to arrive at every
 * enforcement layer as `tools.length === 0`, which each of them read as "no
 * restrictions to install", so the strictest setting available installed
 * nothing. An empty list is an ANSWER, and it denies.
 *
 * `inherited` deliberately does NOT restrict to the coworker-type manifest.
 * A manifest is a composition input, not a permission grant: deriving a
 * restriction from it would silently narrow every group whose type happened
 * not to enumerate a tool, which is exactly the implicit scope change this
 * policy refuses. The manifest still drives what gets composed into
 * CLAUDE.md — it just no longer decides what may be called.
 *
 * ## A registry that will not load is a bug report, not a policy
 *
 * There is no `unresolved` state. When the coworker registry or the MCP tool
 * inventory cannot be read, the resolution carries a `configurationError` and
 * otherwise resolves exactly as it would have. That is safe by construction,
 * not by assumption: `explicit` is the only restrictive state, and the
 * `explicit` branch returns before any manifest lookup and never consults the
 * inventory for enforcement. So a group carrying a restriction cannot be
 * pushed into the error path, and the error path can only be reached by groups
 * whose non-error answer is already unrestricted — it cannot lift anything.
 *
 * Failing closed there would mean a transient registry fault silently
 * degrading a live coworker, which is a worse failure than the one it would be
 * defending against.
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
import { log } from './log.js';
import { getDiscoveredToolInventory } from './mcp-auth-proxy.js';
import type { AgentGroup } from './types.js';

/** Stored form of "unrestricted". Also accepted: `"*"` and `["*"]`. */
export const UNRESTRICTED = '*';

export type McpAllowlistState = 'explicit' | 'inherited' | 'unrestricted';

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
   * deliberately separate — both resolve to "nothing denied", but an operator
   * needs to see whether that is a default or a decision.
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
  /**
   * Does this policy deny anything at all?
   *
   * Separate from `state` on purpose. `state` answers "where did this come
   * from" for an operator; this answers "do I filter" for enforcement. They
   * are nearly always the same question, and the one case where they differ —
   * the `ADMIN_MCP_TOOLS` operator override, which restricts without anyone
   * having stored a list — is exactly the case where conflating them would
   * make one of the two lie.
   */
  restricts: boolean;
  /** One-line origin, for `get` output, approval cards and logs. */
  origin: string;
  /**
   * Set when something this resolution wanted to read could not be read. The
   * policy is still valid — see the header — but an operator needs to know,
   * loudly, that a registry or the tool inventory is broken.
   */
  configurationError: string | null;
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

/** Resolve a group's effective MCP tool allow-list. */
export function resolveMcpAllowlist(group: AllowlistGroup): McpAllowlistResolution {
  const inventory = discoveredTools();
  const inventoryError =
    inventory === null ? 'the MCP tool inventory could not be read — the proxy may not be running' : null;

  const resolution = (
    state: McpAllowlistState,
    restricts: boolean,
    tools: string[],
    origin: string,
    configurationError: string | null = null,
  ): McpAllowlistResolution => {
    // Built-ins are dropped rather than kept-and-ignored so that every
    // downstream consumer — proxy token scope, the container policy, the
    // operator display — sees one list that means exactly one thing.
    const externalTools = tools.filter((t) => !isBuiltinMcpTool(t));
    const permitted = new Set(externalTools);
    return {
      state,
      restricts,
      tools,
      externalTools,
      // An unreadable inventory can't produce a complete blocked list; say so
      // by returning nothing rather than an authoritative-looking short one.
      blocked: restricts ? (inventory ?? []).filter((t) => !isBuiltinMcpTool(t) && !permitted.has(t)) : [],
      origin,
      configurationError,
    };
  };

  const stored = parseStoredAllowlist(group.allowed_mcp_tools);

  // The ONE restrictive branch, and the only one a person can reach: someone
  // ran `ncl groups mcp-tools set`. It returns before any manifest lookup and
  // never depends on the inventory for enforcement, which is what makes the
  // error handling below safe — a restriction cannot be reached by the error
  // path, so the error path cannot lift one.
  //
  // An empty array is an ANSWER, not an absence: "this group may call no
  // external MCP tool". This is the F03 fix.
  if (Array.isArray(stored)) {
    return resolution('explicit', true, stored, 'explicit allow-list on the agent group', inventoryError);
  }

  if (stored === 'unrestricted') {
    return resolution('unrestricted', false, inventory ?? [], 'explicitly unrestricted', inventoryError);
  }

  // Admin groups keep the ADMIN_MCP_TOOLS operator override. It is an
  // instance-wide env var a human sets deliberately, not something a group or
  // an agent can reach, so it is not the implicit narrowing this policy
  // refuses — and removing it would itself be a behaviour change.
  if (group.is_admin) {
    const adminOverride = (process.env.ADMIN_MCP_TOOLS || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (adminOverride.length > 0) {
      return resolution('inherited', true, adminOverride, 'admin default: ADMIN_MCP_TOOLS', inventoryError);
    }
  }

  // Nothing stored → the default, and the default restricts nothing. The
  // coworker-type manifest is deliberately NOT consulted: it is a composition
  // input, and deriving a restriction from it would narrow every group whose
  // type happened not to enumerate a tool — an implicit scope change nobody
  // asked for. `resolveTypeManifest(...).tools` still drives what is composed
  // into CLAUDE.md; it just no longer decides what may be called.
  return resolution(
    'inherited',
    false,
    inventory ?? [],
    'no explicit allow-list — unrestricted by default',
    inventoryError,
  );
}

/**
 * The policy handed to a container at spawn, as the container reads it.
 *
 * This is the whole wire contract for `NANOCLAW_MCP_POLICY`. The container
 * mirrors this shape in `container/agent-runner/src/mcp-policy.ts`.
 *
 * The container copy is defence in depth, not the enforcement point: for an
 * explicit restriction the host has already scoped the proxy token and
 * withheld the external servers from `NANOCLAW_MCP_SERVERS` before the
 * container starts. See that file for the one gap this leaves.
 */
export interface McpPolicyWire {
  /**
   * Whether to filter at all. A boolean, not a state name: the container does
   * not need to know where a policy came from, only whether it restricts, and
   * a boolean cannot be misread the way an unrecognised state name can.
   */
  restrict: boolean;
  /** The permitted EXTERNAL tools. Built-ins are out of scope and never listed. */
  tools: string[];
  origin: string;
}

/** Serialize a resolution into the container-facing policy. */
export function toMcpPolicyWire(resolution: McpAllowlistResolution): McpPolicyWire {
  return { restrict: resolution.restricts, tools: resolution.externalTools, origin: resolution.origin };
}

/**
 * Is this tool permitted under the resolved policy?
 *
 * The single predicate every host-side enforcement point calls, so "allowed"
 * means one thing. `explicit` is the only state that denies; NanoClaw's own
 * built-ins are outside this policy's scope entirely and answer to their own
 * gates.
 */
export function isMcpToolPermitted(resolution: McpAllowlistResolution, tool: string): boolean {
  if (isBuiltinMcpTool(tool)) return true;
  if (!resolution.restricts) return true;
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
  if (!resolution.restricts) return true;
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
