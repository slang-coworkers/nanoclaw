/**
 * The container's view of its MCP tool policy.
 *
 * The host resolves the policy once at spawn (`src/mcp-allowlist.ts`) and
 * hands it over as `NANOCLAW_MCP_POLICY`. Everything inside the container that
 * decides whether an MCP tool exists — which servers get wired at all
 * (`index.ts`), what the SDK is told (`providers/claude.ts`), what the built-in
 * server lists and answers (`mcp-tools/server.ts`) — reads it through here, so
 * there is exactly one definition of "allowed".
 *
 * ## Why an absent policy is PERMISSIVE here
 *
 * Reading a missing variable as a denial would be an implicit scope reduction:
 * a host that is simply older than this file, or one carrying a bug, would
 * silently narrow a live coworker. Nothing may narrow a group except an
 * explicit `ncl groups mcp-tools set`.
 *
 * That is safe because this file is not where an explicit restriction is
 * enforced. By the time the container starts, the host has already scoped the
 * MCP proxy token to the allowed list and withheld every disallowed server
 * from `NANOCLAW_MCP_SERVERS`. The checks here narrow the blast radius; they
 * are not load-bearing.
 *
 * ONE GAP, stated plainly: the `codex` stdio child is constructed in
 * `index.ts`, not passed in `NANOCLAW_MCP_SERVERS`, so the host cannot
 * withhold it. Under an absent policy, `codex` is wired even for a group whose
 * explicit list excludes it. Reaching that state requires a host that failed
 * to set the variable — it is not reachable through configuration — and a
 * group running an agent-runner old enough to ignore the variable would wire
 * codex regardless. Tracked in docs/mcp-allowlist.md.
 *
 * ## Scope: EXTERNAL servers only
 *
 * This policy governs external MCP servers — the `codex` stdio child,
 * `slang-mcp`, `deepwiki`, anything wired through `container.json` or a
 * coworker type. NanoClaw's own `mcp__nanoclaw__*` tools are NOT in scope:
 * each already answers to its own host-side gate, and the built-in server is
 * always wired.
 *
 * ## What this is and is not
 *
 * This is a blast-radius control, not a trust boundary. A group's
 * `/app/src` is a writable mount the agent may edit, so an agent that sets out
 * to defeat these checks can. The enforcement that holds regardless lives on
 * the host: the MCP auth proxy (`src/mcp-auth-proxy.ts`) for proxied servers,
 * and each built-in tool's own delivery guard for the `nanoclaw` surface.
 */

export interface McpPolicy {
  /**
   * Whether to filter at all. A boolean, not a state name — the container does
   * not need to know where a policy came from, only whether it restricts, and
   * a boolean cannot be misread the way an unrecognised state name can.
   */
  restrict: boolean;
  /** The permitted EXTERNAL tools. Meaningful only when `restrict` is true. */
  tools: string[];
  origin: string;
}

/**
 * The MCP server name NanoClaw's own built-in tools are served under.
 *
 * MUST stay identical to `BUILTIN_MCP_SERVER` in `src/mcp-allowlist.ts`
 * (separate runtimes, no shared modules — the host is Node, this is Bun).
 * `src/mcp-allowlist-scope.test.ts` on the host side fails if they drift.
 */
export const BUILTIN_MCP_SERVER = 'nanoclaw';

const BUILTIN_TOOL_PREFIX = `mcp__${BUILTIN_MCP_SERVER}__`;

/**
 * Is this one of NanoClaw's own tools rather than an external server's?
 *
 * The allow-list governs EXTERNAL servers only. NanoClaw's built-ins are
 * outside it: each already answers to its own host-side gate (guard-held
 * approval, an `is_admin` check, or the destination ACL), and gating them a
 * second time here bought no authority while making an unrelated policy knob
 * able to mute an agent.
 *
 * A prefix test, not a list — a built-in added tomorrow is out of scope
 * automatically, which is the direction that cannot break anything.
 */
export function isBuiltinMcpTool(tool: string): boolean {
  return tool.startsWith(BUILTIN_TOOL_PREFIX);
}

/**
 * The policy used when the host said nothing intelligible.
 *
 * `inherited` — the same state a group with no explicit list gets — because
 * "nobody told me to restrict anything" and "nobody has restricted anything"
 * must produce the same behaviour. Denying here would be an implicit scope
 * reduction triggered by a host bug.
 */
export const NO_POLICY_STATED: McpPolicy = {
  restrict: false,
  tools: [],
  origin: 'NANOCLAW_MCP_POLICY missing or unparseable — applying no external restrictions',
};

/**
 * Read the spawn-time policy out of the environment.
 *
 * Never throws. Any shape we don't recognise resolves to `NO_POLICY_STATED`,
 * which restricts nothing — see the header for why that is the safe default
 * here and where the real enforcement lives.
 */
export function parseMcpPolicy(env: Record<string, string | undefined> = process.env): McpPolicy {
  const raw = env.NANOCLAW_MCP_POLICY;
  if (!raw) return NO_POLICY_STATED;
  try {
    const parsed = JSON.parse(raw) as Partial<McpPolicy>;
    if (typeof parsed.restrict !== 'boolean') return NO_POLICY_STATED;
    if (!parsed.restrict) {
      return { restrict: false, tools: [], origin: typeof parsed.origin === 'string' ? parsed.origin : 'unknown' };
    }
    // Built-ins are dropped rather than honoured: they are out of scope, so a
    // host that lists one is not granting anything and a host that omits one
    // is not denying anything. Keeping them out means one list, one meaning.
    const tools = Array.isArray(parsed.tools)
      ? parsed.tools.map(String).filter((t) => t.startsWith('mcp__') && !isBuiltinMcpTool(t))
      : [];
    return { restrict: true, tools, origin: typeof parsed.origin === 'string' ? parsed.origin : 'unknown' };
  } catch {
    return NO_POLICY_STATED;
  }
}

/**
 * Is this tool allowed?
 *
 * Only a restricting policy — one someone created with `ncl groups mcp-tools
 * set` — denies anything. NanoClaw's own built-ins are never this policy's
 * business and always pass.
 */
export function isMcpToolAllowed(policy: McpPolicy, tool: string): boolean {
  if (isBuiltinMcpTool(tool)) return true;
  if (!policy.restrict) return true;
  return policy.tools.includes(tool);
}

/**
 * Does the policy permit ANY tool on this MCP server?
 *
 * Used to decide whether a direct (non-proxied) server is worth wiring at all.
 * Not wiring it is the strongest available revocation for a stdio server: the
 * tools do not exist in the session, so no deny list has to be complete and no
 * wildcard-matching semantics have to be trusted.
 */
export function serverHasAllowedTools(policy: McpPolicy, serverName: string): boolean {
  // The built-in server is always wired: out of scope, and it carries the only
  // path an agent has to say anything at all.
  if (serverName === BUILTIN_MCP_SERVER) return true;
  if (!policy.restrict) return true;
  // SDK sanitizes server names into tool prefixes; compare on the sanitized
  // form so `slang-mcp` and `slang_mcp` don't disagree with the SDK.
  const prefix = `mcp__${sanitizeServerName(serverName)}__`;
  return policy.tools.some((t) => t.startsWith(prefix));
}

/**
 * MCP server names are sanitized by the SDK when forming tool prefixes: any
 * character outside [A-Za-z0-9_-] becomes '_'.
 */
export function sanitizeServerName(serverName: string): string {
  return serverName.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** The tools this policy permits on one server, SDK-prefixed. */
export function allowedToolsForServer(policy: McpPolicy, serverName: string): string[] {
  const prefix = `mcp__${sanitizeServerName(serverName)}__`;
  return policy.tools.filter((t) => t.startsWith(prefix));
}
