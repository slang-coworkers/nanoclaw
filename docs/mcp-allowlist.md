# MCP tool allow-list — scope, states and enforcement

Which **external** MCP tools an agent group may call is one policy, resolved in
one place (`src/mcp-allowlist.ts`) and enforced in several — because MCP tools
reach the agent by several different routes and no single check covers them all.

Operator surface: `ncl groups mcp-tools get --id <ag>` and
`ncl groups mcp-tools set --id <ag> --tools <…>`.

## Scope: external servers only

There are two kinds of MCP tool in a NanoClaw container:

| | examples | governed by |
|---|---|---|
| **External** | `slang-mcp`, `deepwiki`, the `codex` stdio child, anything in `container.json` or a coworker type's `mcpServers` | **this allow-list** |
| **Built-in** | `mcp__nanoclaw__*` — `send_message`, `install_packages`, `create_agent`, … | **their own gates**, per tool (table below) |

The allow-list does **not** restrict built-ins. `--tools '[]'` denies every
external tool and leaves NanoClaw's own surface untouched.

That is a deliberate correction. Gating built-ins through the allow-list as
well added no authority — a coworker type that grants the tool still granted
it, and the manifests grant essentially all of them — while making an unrelated
policy knob able to revoke `ask_user_question` or `record_decision` from a group
whose type simply had not enumerated them.

The boundary is a prefix test (`isBuiltinMcpTool`), not a list of tool names, so
a built-in registered tomorrow is out of scope automatically.

## Only an explicit list restricts anything

The stored column is `agent_groups.allowed_mcp_tools`. **Nothing implicit may
change a group's scope — only an explicit `ncl groups mcp-tools set` may reduce
or add it.**

| stored          | state          | restricts? | effect                                  |
| --------------- | -------------- | ---------- | --------------------------------------- |
| `["mcp__a__b"]` | `explicit`     | yes        | exactly that list; all other external tools denied |
| `[]`            | `explicit`     | yes        | **every external MCP tool denied**      |
| `*`             | `unrestricted` | no         | nothing denied                          |
| `NULL`          | `inherited`    | no         | nothing denied — **the default**        |

`inherited` deliberately does **not** restrict to the coworker-type manifest.
A manifest is a composition input, not a permission grant: deriving a
restriction from it would narrow every group whose type happened not to
enumerate a tool, which is exactly the implicit scope change this policy
refuses. `manifest.tools` still drives what the composer renders into
CLAUDE.md — it just no longer decides what may be called.

The one exception is `ADMIN_MCP_TOOLS`, an instance-wide operator env var that
narrows admin groups. It predates this policy, a human sets it deliberately,
and no group or agent can reach it. That is why the resolution carries
`restricts` separately from `state`: `state` says where a policy came from,
`restricts` says whether it filters, and this is the one case where they differ.

**An empty list is an answer.** `[]` used to arrive at every enforcement layer
as `tools.length === 0`, which each of them read as "no restrictions to
install" — so the strictest setting available installed nothing. That is F03,
and it stays fixed.

### A registry that will not load is a bug report, not a policy

There is no `unresolved` state. When the coworker registry or the MCP tool
inventory cannot be read, the resolution carries a `configurationError` — an
ERROR line at spawn and a `configuration_error` field in `mcp-tools get` — and
otherwise resolves exactly as it would have.

That is safe by construction, not by assumption. `explicit` is the only
restrictive state; its branch returns before any registry lookup and never
consults the inventory for enforcement. So a group carrying a restriction
cannot be pushed onto the error path, and the error path can only be reached by
groups whose non-error answer is already "nothing denied" — it cannot lift
anything. Failing closed there would let a transient registry fault silently
degrade a live coworker, which is a worse failure than the one it would defend
against.

## The built-in tools and what actually governs each one

Keeping built-ins out of the allow-list is only defensible if each one answers
to a gate of its own. Here is every tool the built-in server registers, and
what governs it. `src/builtin-mcp-gates.test.ts` asserts this table against the
delivery registry, so it cannot quietly go stale.

| tool | host effect | gate |
|---|---|---|
| `send_message` | outbound chat message | destination ACL in `deliverMessage` (origin chat, or an `agent_destinations` row); agent-to-agent goes through `routeAgentMessage` + the A2A message gate |
| `send_file` | outbound file | same |
| `add_reaction` | reaction | same |
| `ask_user_question` | question card + `pending_questions` row | same destination ACL |
| `send_card` | interactive card | same destination ACL |
| `install_packages` | image rebuild | **guard-held** — `self_mod.install_packages`, admin approval per request |
| `add_mcp_server` | container-config MCP server | **guard-held** — `self_mod.add_mcp_server`, admin approval |
| `create_agent` | new agent group + container | **guard-held** — `agents.create`, admin approval |
| `record_decision` | `approval_decisions` row | **guard-held** — plus the `APPROVAL_LEDGER_WRITERS` capability, fail-closed when unset |
| `wire_agents` | mutates destination ACLs | unguarded at the delivery seam, but the handler refuses a non-`is_admin` caller |
| `request_restart` | restarts the caller's own container | unguarded, deliberately — not a privilege |
| `append_learning` | file in the shared learnings dir | ⚠️ **unguarded** — see below |
| `report_pr_created` | `pr_session_mappings` row (action `map_pr_session`) | ⚠️ **unguarded** — see below |

`ncl` is not in this table and not covered by the allow-list: it is a CLI
reached over Bash, and every command it carries is gated separately by
`cli_scope` and the guard in `src/cli/dispatch.ts`. `record_human_verdict`
likewise — it arrives from the GitHub webhook, not from a tool call.

### ⚠️ Two built-ins whose own gate is weaker than it looks

Both predate this change and neither was ever mitigated by the allow-list —
`base-nanoclaw` grants both to every typed coworker, so the allow-list handed
them out by default. Removing them from allow-list scope loses no protection
that existed. They need argument-level authorization, which an allow-list
cannot express, and they are tracked as follow-ups rather than fixed here.

- **`report_pr_created`** writes `pr_session_mappings` with `INSERT OR REPLACE`
  — the routing source of truth for GitHub webhooks. Any agent group can claim
  any `(repo, pr_number)` and redirect that PR's future webhook deliveries to
  its own session; a takeover within the same instance does not even warn (only
  an `owner_instance` flip logs). Needs a check that the calling session has a
  legitimate claim to the PR.
- **`append_learning`** writes into `data/shared/learnings/`, which every agent
  group reads. One group can therefore place text into another's context.
  Append-only and non-destructive, but unauthenticated.

## Where it is enforced

Host — holds regardless of what the container does:

1. **MCP auth proxy** (`src/mcp-auth-proxy.ts`) — per-container bearer token
   scoped to the resolved list. Covers proxied servers only; it deliberately
   excludes `mcp__nanoclaw__*` and has no visibility into direct stdio servers.
   An empty scope denies every `tools/call` with a `-32600`.
2. **Withholding server wiring at spawn** (`src/container-runner.ts`) — a
   server in `NANOCLAW_MCP_SERVERS` that the policy allows no tool on is not
   handed to the container at all, so its `env` block (which can carry
   credentials) never crosses the boundary.

Container — reduces blast radius, but see the caveat below:

3. **Not wiring direct servers** (`container/agent-runner/src/index.ts`) — the
   `codex` stdio child and any withheld server are simply never started. The
   built-in server is always wired.
4. **PreToolUse default-deny** (`providers/claude.ts`) — every external `mcp__`
   call is checked against the policy at the call. Independent of how the SDK
   interprets allow/deny patterns and of whether the host inventory is complete.

The spawn-time policy travels as `NANOCLAW_MCP_POLICY` (JSON:
`{restrict, tools, origin}` — a boolean rather than a state name, because the
container needs to know only whether it filters). A missing or unparseable
value restricts nothing: reading silence as a denial would let a host bug, or a
host simply older than the container's copy of the runner, narrow a live
coworker.

That is safe because the container is not where a restriction is enforced. By
the time it starts, the host has already scoped the MCP proxy token to the
allowed list and withheld every disallowed server from `NANOCLAW_MCP_SERVERS`.

> **One gap, stated plainly.** The `codex` stdio child is constructed inside
> the container, not passed in `NANOCLAW_MCP_SERVERS`, so the host cannot
> withhold it. Under a missing policy variable `codex` is wired even for a
> group whose explicit list excludes it. That state is not reachable through
> configuration — it needs a host that failed to set the variable — and a group
> running an agent-runner old enough to ignore the variable would wire codex
> anyway.

> **Container-side enforcement is not a trust boundary.** A group's
> agent-runner source (`data/v2-sessions/<ag-id>/agent-runner-src`, mounted at
> `/app/src`) is writable and the agent may edit it. Layers 3–4 defend against
> prompt injection and confused-deputy misuse. Against an agent that sets out
> to defeat them, only layers 1–2 and the per-tool gates above hold.

## Changing the policy on a live group

`ncl groups mcp-tools set` does two things:

- **Immediately**: re-scopes every live proxy token for the group (external
  servers only — the token never carried `mcp__nanoclaw__*`).
- **Pending restart**: kills every running container in the **agent group** and
  respawns it through the normal on-wake lifecycle
  (`src/container-restart.ts`).

The restart is not optional and not caller-scoped. A running container
snapshots its MCP policy at boot — the SDK is handed its tool configuration
once per query and a wired stdio server is a live child process — so nothing
the host can say to a running container revokes a direct tool. And
`allowed_mcp_tools` is a column on the group, which routinely has several live
sessions; restarting only the caller's session would leave every sibling
holding the privileges just revoked.

The response reports this honestly: `enforcement.direct_mcp_servers` is
`pending-restart` while containers are coming back, `applied` when there were
none. It never claims a narrowing landed before it did.

Ordering: the restart is deferred until the response frame is durable (see
`src/cli/post-response.ts`), so a caller that is itself in the affected group
receives its answer before its container is killed.

## Deploying this to an existing install

Deploying this is a **no-op for every existing group**. Every group has
`allowed_mcp_tools: null`, which restricts nothing on every surface —
regardless of coworker type, whether the registry loads, or whether the MCP
proxy is up. `src/mcp-allowlist-no-op.test.ts` asserts exactly that. Nothing
changes for anyone until an operator runs `ncl groups mcp-tools set`.


`agent-runner-src` is copied per group at creation and **never auto-updated**.
Groups created before this landed keep an `/app/src` that ignores
`NANOCLAW_MCP_POLICY`, so container-side layers 3–4 are inert for them until
the copy is refreshed:

```bash
# Stop the host first; then refresh each group's runner source.
for d in data/v2-sessions/*/agent-runner-src; do
  rsync -a --delete container/agent-runner/src/ "$d/"
done
```

Host-side layers 1–2 apply immediately on host restart, with no group refresh,
and so do the per-tool gates on the built-in surface — those live in
`handleSystemAction`'s guard consult and were never container-side.
