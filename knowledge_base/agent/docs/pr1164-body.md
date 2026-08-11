Follow-up to #1157 (merged). The owner corrected the SCOPE and they're right: the allow-list should govern **external** MCP servers, not NanoClaw's own tools.

## What #1157 got wrong

It treated the whole MCP surface as configurable, which swept in `mcp__nanoclaw__*`. To stop `--tools '[]'` from muting an agent it then carved out a three-tool "mandatory transport floor" and denied the rest of the built-in surface. Consequences:

- a coworker type whose manifest didn't enumerate `ask_user_question` / `record_decision` / `install_packages` lost them;
- the fix needed a **compensating data edit** (adding `record_decision` to `base-nanoclaw`'s `allowed-tools`) purely to stop existing groups breaking. A fix that has to patch the data to avoid breaking things is describing its own scope error;
- that is the whole of rollout caveat A, and it is now gone.

## The corrected boundary

| | examples | governed by |
|---|---|---|
| **External** | `slang-mcp`, `deepwiki`, the `codex` stdio child, anything in `container.json` or a type's `mcpServers` | **this allow-list** |
| **Built-in** | `mcp__nanoclaw__*` | **their own per-tool gates** |

Implemented as a prefix test (`isBuiltinMcpTool`), not a list of tool names — a built-in registered tomorrow is out of scope automatically, which is the only direction that cannot silently break a group. `MANDATORY_MCP_TOOLS` is gone; the floor was the wrong shape, as you said.

## Requirement 3: the enumeration, verified not assumed

`src/builtin-mcp-gates.test.ts` maps all 13 built-ins to their delivery action and asserts the guard declaration **against the registry**, so this table can't rot.

| tool | host effect | gate |
|---|---|---|
| `send_message` | outbound chat | destination ACL in `deliverMessage` (origin chat or `agent_destinations` row); a2a via `routeAgentMessage` + A2A message gate |
| `send_file` | outbound file | same |
| `add_reaction` | reaction | same |
| `ask_user_question` | question card + `pending_questions` | same destination ACL |
| `send_card` | interactive card | same destination ACL |
| `install_packages` | image rebuild | **guard-held** — `self_mod.install_packages`, admin approval |
| `add_mcp_server` | container-config MCP server | **guard-held** — `self_mod.add_mcp_server`, admin approval |
| `create_agent` | new agent group + container | **guard-held** — `agents.create`, admin approval |
| `record_decision` | `approval_decisions` row | **guard-held** + `APPROVAL_LEDGER_WRITERS` capability (fail-closed when unset) |
| `wire_agents` | mutates destination ACLs | unguarded at the delivery seam; handler refuses non-`is_admin` |
| `request_restart` | restarts own container | unguarded, deliberately — not a privilege |
| `append_learning` | shared learnings file | ⚠️ **unguarded** |
| `report_pr_created` | `pr_session_mappings` row (action `map_pr_session`) | ⚠️ **unguarded** |

Not in the table and deliberately so: `ncl` (a CLI over Bash, gated by `cli_scope` + the dispatch guard) and `record_human_verdict` (arrives from the GitHub webhook, not a tool call).

### ⚠️ Two built-ins whose gate is weaker than it looks — NOT silently dropped

You asked me to say plainly if any privileged built-in has no independent gate. Two do not.

**`report_pr_created`** — `upsertPrMapping` is an unconditional `INSERT OR REPLACE` on `(repo, pr_number)`, and `pr_session_mappings` is the routing source of truth for GitHub webhooks (`github-webhook-server.ts`, `modules/pr-mapping/forward.ts`). Any agent group can claim any repo+PR and redirect that PR's future webhook deliveries to its own session. Only an `owner_instance` flip warns — a same-instance takeover is silent. Its registered reason says "no privileged central-DB mutation", which is inaccurate.

**`append_learning`** — writes into `data/shared/learnings/`, which every group reads and which is mounted into every container. One group can place text into another's context. Append-only and non-destructive, but unauthenticated.

**My recommendation is to fix them with a guard, not to keep them in allow-list scope**, and here is why that isn't me taking the easy path: `base-nanoclaw` grants both to every typed coworker, so the allow-list handed them out by default and never mitigated this attack. Under #1157 a `slang-fix` coworker could still hijack any PR mapping. Keeping them in scope would be security theatre *and* would reintroduce exactly the coupling you asked to remove. What they actually need is argument-level authorization ("does this session have a claim to this PR?"), which an allow-list cannot express.

They are documented in `docs/mcp-allowlist.md` and pinned by a **canary test that fails when someone fixes them**, so the docs get updated in the same change. Happy to open follow-up findings if you want them tracked separately.

## What is unchanged

- `explicit(∅)` / `inherited(∅)` still deny **every external** tool.
- `unresolved` still fails closed and loudly (ERROR at spawn, `configuration_error` in `mcp-tools get`); a missing/corrupt `NANOCLAW_MCP_POLICY` still reads as `unresolved`.
- Proxy token scope, withholding unusable servers at spawn, not wiring them in the container, PreToolUse default-deny — all still there, now external-only.
- **P1-b untouched**: group-wide restart, `proxied: applied` / `direct: pending-restart`, response-before-restart ordering.

## Acceptance

Failing-first verified by stashing source and keeping tests on the merged #1157 tree:

| Proof | Test | On #1157 |
|---|---|---|
| `[]` permits the **entire** built-in surface, not a 3-tool floor | `claude.mcp-policy.test.ts` | **5/12 fail** |
| built-ins out of scope in the resolver, wire format and server wiring | `mcp-allowlist-scope.test.ts` | **9/11 fail** behaviourally |
| `[]` still denies codex + proxy tools | `mcp-allowlist-scope.test.ts` (labelled) | passes both — **regression guard**, marked as such in the file |
| gate inventory matches the registry | `builtin-mcp-gates.test.ts` | new-API |

**Where I could not make it fail first:** `builtin-mcp-gates.test.ts` needs `describeDeliveryActionGuard`, a read side this PR adds, so it fails pre-fix as a missing symbol rather than a wrong answer. Two assertions inside `mcp-allowlist-scope.test.ts` (the `BUILTIN_MCP_SERVER` cross-runtime parity check and the prefix-test check) are likewise new-API and are commented as such in place. Everything else fails for a behavioural reason.

## Gates

- `pnpm run build` clean · `typecheck-gate` no drift · `prettier --check` clean · `validate:templates` clean
- `pnpm run lint` — 34 errors before, 34 after
- `pnpm exec vitest run` — 9 failures, exactly the known baseline (7 `scripts/q.test.ts`, 2 `src/gate-plan-script.test.ts`) plus the `setup/register.test.ts` import failure on a checkout without skill-installed channels
- `bun test` — 1 failure, the known `Bun.YAML` scaffold baseline

## Reverted from #1157

- `container/skills/base-nanoclaw/SKILL.md` — the `record_decision` addition, needed only to compensate for the scope error.
- `src/delivery-wire-agents.test.ts` — the `allowed_mcp_tools: '*'` grant the old gate forced into a test about the admin check.
- The host delivery-action gate and the built-in server's self-filtering are removed; `server.mcp-policy.test.ts` goes with them.

## Rollout caveats now

- **Caveat A (non-admin `main` groups) is gone.** It existed only because built-ins were in scope. A group with an empty inherited manifest now loses no NanoClaw capability. No pre-rollout sweep needed.
- **Caveat B stands**: `agent-runner-src` is per-group and never auto-updated, so container-side layers stay inert for pre-existing groups until refreshed (`docs/mcp-allowlist.md`). Host-side layers and the per-tool built-in gates apply immediately — the built-in gates were never container-side.

