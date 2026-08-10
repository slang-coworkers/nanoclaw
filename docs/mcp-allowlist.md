# MCP tool allow-list — states and enforcement

Which MCP tools an agent group may call is one policy, resolved in one place
(`src/mcp-allowlist.ts`) and enforced in several — because MCP tools reach the
agent by several different routes and no single check covers them all.

Operator surface: `ncl groups mcp-tools get --id <ag>` and
`ncl groups mcp-tools set --id <ag> --tools <…>`.

## The four states

The stored column is `agent_groups.allowed_mcp_tools`.

| stored          | state          | effective tools                                     |
| --------------- | -------------- | --------------------------------------------------- |
| `["mcp__a__b"]` | `explicit`     | exactly that list                                     |
| `[]`            | `explicit`     | **nothing configurable** — the mandatory floor only   |
| `NULL`          | `inherited`    | the coworker-type manifest (every discovered tool for an admin group) |
| `*`             | `unrestricted` | every discovered tool                                 |
| —               | `unresolved`   | the list could not be computed → **deny everything configurable** |

`unresolved` is not a stored value. It is what the resolver returns when it
cannot answer: the coworker registry failed to load, or the MCP tool inventory
could not be read. It is reported by `mcp-tools get` with a
`configuration_error` field and logged at ERROR on every spawn.

**An empty list is an answer; an unresolvable list is a fault.** Both deny
everything configurable — the difference is that one is a policy you chose and
the other is a bug you should fix. Neither is ever read as "no restrictions".

## The mandatory transport floor

`MANDATORY_MCP_TOOLS` (`src/mcp-allowlist.ts`, mirrored in
`container/agent-runner/src/mcp-policy.ts`) sits **outside** the
user-configurable allow-list:

- `mcp__nanoclaw__send_message`
- `mcp__nanoclaw__send_file`
- `mcp__nanoclaw__add_reaction`

A task session's only delivery path is `send_message` (`poll-loop.ts`), so
denying the outbound transport does not restrict an agent — it silences one,
including its ability to report that it was silenced. Everything else on the
built-in server (`install_packages`, `add_mcp_server`, `request_restart`,
`create_agent`, `wire_agents`, `record_decision`, `report_pr_created`,
`append_learning`, `ask_user_question`, `send_card`) **is** configurable and
is denied by `--tools '[]'`.

`ncl` is deliberately **not** on this list and not covered by the allow-list at
all: it is a CLI reached over Bash, and every command it carries is gated
separately by `cli_scope` and the guard in `src/cli/dispatch.ts`.

The two copies of the list live in different runtimes (Node host, Bun
container) and share no modules. `src/mcp-allowlist-enforcement.test.ts` reads
the container file and fails the build if they drift.

## Where it is enforced

Host — holds regardless of what the container does:

1. **MCP auth proxy** (`src/mcp-auth-proxy.ts`) — per-container bearer token
   scoped to the resolved list. Covers proxied servers only; it deliberately
   excludes `mcp__nanoclaw__*` and has no visibility into direct stdio servers.
   An empty scope denies every `tools/call` with a `-32600`.
2. **Delivery-action gate** (`src/delivery.ts`, `NANOCLAW_ACTION_TOOLS`) —
   every built-in tool with a host-side effect writes a system action, and this
   is the one place that action must pass through host code. A denial is logged
   at ERROR and written back to the agent as a system message.
3. **Withholding server wiring at spawn** (`src/container-runner.ts`) — a
   server in `NANOCLAW_MCP_SERVERS` that the policy allows no tool on is not
   handed to the container at all, so its `env` block (which can carry
   credentials) never crosses the boundary.

Container — reduces blast radius, but see the caveat below:

4. **Not wiring direct servers** (`container/agent-runner/src/index.ts`) — the
   `codex` stdio child and any withheld server are simply never started.
5. **The built-in server filters itself** (`mcp-tools/server.ts`) — denied
   tools are neither listed nor answered. Applies to every provider, including
   Codex, which has no PreToolUse hook.
6. **PreToolUse default-deny** (`providers/claude.ts`) — every `mcp__` call is
   checked against the policy at the call. Independent of how the SDK
   interprets allow/deny patterns and of whether the host inventory is complete.

The spawn-time policy travels as `NANOCLAW_MCP_POLICY` (JSON:
`{state, tools, origin}`). A missing or unparseable value is read as
`unresolved`, so a host that fails to set it fails closed.

> **Container-side enforcement is not a trust boundary.** A group's
> agent-runner source (`data/v2-sessions/<ag-id>/agent-runner-src`, mounted at
> `/app/src`) is writable and the agent may edit it. Layers 4–6 defend against
> prompt injection and confused-deputy misuse. Against an agent that sets out
> to defeat them, only layers 1–3 hold.

## Changing the policy on a live group

`ncl groups mcp-tools set` does two things:

- **Immediately**: re-scopes every live proxy token for the group.
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

`agent-runner-src` is copied per group at creation and **never auto-updated**.
Groups created before this landed keep an `/app/src` that ignores
`NANOCLAW_MCP_POLICY`, so container-side layers 4–6 are inert for them until
the copy is refreshed:

```bash
# Stop the host first; then refresh each group's runner source.
for d in data/v2-sessions/*/agent-runner-src; do
  rsync -a --delete container/agent-runner/src/ "$d/"
done
```

Host-side layers 1–3 apply immediately on host restart, with no group
refresh — which is the reason the built-in surface is gated on the host.
