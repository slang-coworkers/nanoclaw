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
 * ## What this is and is not
 *
 * This is a blast-radius control, not a trust boundary. A group's
 * `/app/src` is a writable mount the agent may edit, so an agent that sets out
 * to defeat these checks can. The enforcement that holds regardless lives on
 * the host: the MCP auth proxy (`src/mcp-auth-proxy.ts`) for proxied servers,
 * and the delivery-action gate in `src/delivery.ts` for the built-in
 * `nanoclaw` surface.
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
 * Built-in MCP tools that sit OUTSIDE the user-configurable allow-list.
 *
 * MUST stay identical to `MANDATORY_MCP_TOOLS` in `src/mcp-allowlist.ts`
 * (separate runtimes, no shared modules — the host is Node, this is Bun).
 * `src/mcp-policy-parity.test.ts` on the host side fails if they drift.
 *
 * The rationale lives with the host copy: a task session's only delivery path
 * is `send_message`, so denying the outbound transport does not restrict an
 * agent, it silences one — including its ability to report that it was
 * silenced.
 */
export const MANDATORY_MCP_TOOLS: readonly string[] = [
  'mcp__nanoclaw__send_message',
  'mcp__nanoclaw__send_file',
  'mcp__nanoclaw__add_reaction',
];

/** The policy used when the host said nothing intelligible. Denies everything configurable. */
export const UNRESOLVED_POLICY: McpPolicy = {
  state: 'unresolved',
  tools: [...MANDATORY_MCP_TOOLS],
  origin: 'NANOCLAW_MCP_POLICY missing or unparseable — denying all configurable MCP tools',
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
    const tools = Array.isArray(parsed.tools) ? parsed.tools.map(String).filter((t) => t.startsWith('mcp__')) : [];
    return {
      state: parsed.state,
      // Belt and braces: union the floor in on this side too, so a host that
      // forgets it cannot mute the agent.
      tools:
        parsed.state === 'unrestricted' ? tools : [...new Set([...tools, ...MANDATORY_MCP_TOOLS])],
      origin: typeof parsed.origin === 'string' ? parsed.origin : 'unknown',
    };
  } catch {
    return UNRESOLVED_POLICY;
  }
}

/** Default-deny predicate. `unrestricted` is the only state that permits by omission. */
export function isMcpToolAllowed(policy: McpPolicy, tool: string): boolean {
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
