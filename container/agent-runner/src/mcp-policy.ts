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
 * ## Why an absent policy is a DENIAL
 *
 * The old contract was `NANOCLAW_ALLOWED_MCP_TOOLS`, and the host only set it
 * when the list was non-empty. So "allow no MCP tools" and "the host said
 * nothing" were the same input, and the container read both as "install no
 * restrictions" — while simultaneously wildcard-allowing `mcp__nanoclaw__*`
 * and `mcp__codex__*` because those servers were in its own `mcpServers` map
 * and never traversed the host proxy. An empty allow-list therefore granted
 * the full built-in tool surface.
 *
 * Here, a missing or unparseable policy is `unresolved`, which permits only
 * the mandatory transport floor. The host now always sets the variable, so an
 * absent one means a version skew or a tampered spawn — neither is a reason to
 * hand over `install_packages`.
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

/** Matches `McpAllowlistState` in src/mcp-allowlist.ts. */
export type McpPolicyState = 'explicit' | 'inherited' | 'unrestricted' | 'unresolved';

export interface McpPolicy {
  state: McpPolicyState;
  /** Everything callable. Mandatory transport is already unioned in by the host. */
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

/** The policy used when the host said nothing intelligible. Denies every EXTERNAL tool. */
export const UNRESOLVED_POLICY: McpPolicy = {
  state: 'unresolved',
  tools: [],
  origin: 'NANOCLAW_MCP_POLICY missing or unparseable — denying all external MCP tools',
};

function isState(value: unknown): value is McpPolicyState {
  return value === 'explicit' || value === 'inherited' || value === 'unrestricted' || value === 'unresolved';
}

/**
 * Read the spawn-time policy out of the environment.
 *
 * Never throws and never returns a permissive fallback: any shape we don't
 * recognise resolves to `UNRESOLVED_POLICY`.
 */
export function parseMcpPolicy(env: Record<string, string | undefined> = process.env): McpPolicy {
  const raw = env.NANOCLAW_MCP_POLICY;
  if (!raw) return UNRESOLVED_POLICY;
  try {
    const parsed = JSON.parse(raw) as Partial<McpPolicy>;
    if (!isState(parsed.state)) return UNRESOLVED_POLICY;
    // Built-ins are dropped rather than honoured: they are out of scope, so a
    // host that lists one is not granting anything and a host that omits one
    // is not denying anything. Keeping them out means one list, one meaning.
    const tools = Array.isArray(parsed.tools)
      ? parsed.tools.map(String).filter((t) => t.startsWith('mcp__') && !isBuiltinMcpTool(t))
      : [];
    return {
      state: parsed.state,
      tools,
      origin: typeof parsed.origin === 'string' ? parsed.origin : 'unknown',
    };
  } catch {
    return UNRESOLVED_POLICY;
  }
}

/**
 * Default-deny predicate for EXTERNAL tools. `unrestricted` is the only state
 * that permits by omission; NanoClaw's own built-ins are never this policy's
 * business and always pass.
 */
export function isMcpToolAllowed(policy: McpPolicy, tool: string): boolean {
  if (isBuiltinMcpTool(tool)) return true;
  if (policy.state === 'unrestricted') return true;
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
  if (policy.state === 'unrestricted') return true;
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
