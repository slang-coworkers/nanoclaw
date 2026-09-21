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
| `append_learning` | file in the shared learnings dir | unguarded, but every write is attributed to its author group + session |
| `report_pr_created` | `pr_session_mappings` row (action `map_pr_session`) | unguarded at the seam; the handler is **first-claim-wins** — see below |

`ncl` is not in this table and not covered by the allow-list: it is a CLI
reached over Bash, and every command it carries is gated separately by
`cli_scope` and the guard in `src/cli/dispatch.ts`. `record_human_verdict`
likewise — it arrives from the GitHub webhook, not from a tool call.

### The two that used to have no gate at all

Both are fixed. Recorded here because the shape of the fix matters: neither
could be expressed as an allow-list entry, which is why removing them from
allow-list scope lost nothing — the allow-list was never mitigating them.
`base-nanoclaw` grants both to every typed coworker, so it handed them out by
default.

- **`report_pr_created`** wrote `pr_session_mappings` with `INSERT OR REPLACE`.
  `pr_session_mappings` decides where a PR's GitHub webhooks are delivered, and
  both writers take `repo`/`pr_number` from an agent-composed message, so any
  group could name any PR and capture its traffic — silently, when the takeover
  was same-instance. Now **first-claim-wins**: the holder may refresh its own
  row (its session id changes on every container restart), anyone else is
  refused, the refusal is logged at ERROR naming both claimants, and the agent
  is told so it does not sit waiting for review comments that will never
  arrive. Corrections go through `ncl pr-mappings remap`, which is
  approval-gated and refuses an agent pointing a PR at its own group. See
  `src/modules/pr-mapping/store.ts` for why the claim is ordered rather than
  proved.

- **`append_learning`** writes into `data/shared/learnings/`, which is mounted
  into every container — so one group's write lands in every other group's
  context. The write stays open (restricting it would break the feature) but it
  is no longer anonymous: each learning carries front-matter naming the author
  group and session, files live under a per-group subdirectory, and the index
  shows the author beside every entry. Files written before this are still
  listed and still readable at their old paths, marked `unattributed`.

`src/builtin-mcp-gates.test.ts` asserts the classification above against the
delivery registry, and asserts that the known-weak list is **empty** — adding a
knowingly-weak built-in is now the thing that has to be deliberate.

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

## The `codex` child's git is read-only

The `codex-critique` skill calls `mcp__codex__codex` with sandbox
`danger-full-access` (bwrap cannot create namespaces inside Docker, and
`container/hooks/force-codex-sandbox.sh` forces the value) and cwd
`/workspace/agent` — the role's group folder, which holds its git worktrees.
Codex is meant to read and critique. On 2026-09-19 it did not, three times: it
amended an ADR twice and then committed on the builder's worktree and
force-pushed the PR branch, orphaning the legitimate head.

So the child's git is pinned read-only through config that exists only in its
environment. `container/agent-runner/src/codex-mcp-server.ts` builds the codex
MCP entry with three layers in `env` (literal, non-secret); each covers what
the one before cannot:

| layer | delivered as | effect |
| ----- | ------------ | ------ |
| **Refusing hooks** | `GIT_CONFIG_KEY_0=core.hooksPath` → `/app/hooks/codex-git-guard` | `pre-commit`, `pre-merge-commit`, `pre-rebase`, `pre-push` and `reference-transaction` (exit 1 on `prepared`) all refuse with `codex critique is read-only: git <hook> refused (codex-git-guard)`. The last one catches every ref write: `commit --no-verify`, `update-ref`, `branch -f`, `reset --hard`, `checkout -B`, `tag`, `stash`, `fetch`, `merge` (ORIG_HEAD) |
| **No transport at all** | `GIT_CONFIG_KEY_1..7=url.disabled://.pushInsteadOf` = `https://`, `http://`, `git@`, `ssh://`, `file://`, `/`, `.`; `GIT_CONFIG_KEY_8=protocol.allow=never`; `GIT_CONFIG_KEY_9=protocol.file.allow=never` | The rewrite turns a push URL derived from a remote's fetch URL, or given explicitly, into a scheme nothing serves. The protocol policy is what actually closes pushes: `pushInsteadOf` is ignored for a remote with an explicit pushurl (`git remote set-url --push …` — a plain `.git/config` write no hook sees), for scp-style `user@host:` with a non-`git` user, and for a short URL expanded by an `insteadOf` alias; `protocol.allow=never` is checked on the transport *type*, so every one of those dies client-side with `fatal: transport 'https' not allowed` (or `'file'`, `'ssh'`, `'disabled'`), `--no-verify` or not. `protocol.file.allow` must be explicit — a per-protocol key beats the `protocol.allow` fallback at any scope, and a global `protocol.file.allow=always` is common |
| **System-scope backstop** | `GIT_CONFIG_SYSTEM=/app/hooks/codex-git-guard/gitconfig` — the same table in gitconfig syntax | `GIT_CONFIG_COUNT/KEY/VALUE` and `-c` (`GIT_CONFIG_PARAMETERS`) are stripped from the `receive-pack` git spawns for a local-path push (`local_repo_env`); `GIT_CONFIG_SYSTEM` is not. So even `git -c protocol.file.allow=always -c core.hooksPath=/dev/null push --no-verify ../clone` is refused on the remote side by *its* `reference-transaction`. System scope, not global: `GIT_CONFIG_GLOBAL` would replace `~/.gitconfig` and drop the OneCLI placeholder `insteadOf` that `container-runner.ts` writes there |

Git reads `GIT_CONFIG_*` at command scope, above repo, worktree and global
config, so a worktree's own `core.hooksPath` cannot undo the first two layers.
The hooks dir and the gitconfig ride the existing read-only bind mount of
`container/hooks` at `/app/hooks` (`src/container-runner.ts`); nothing is
COPY'd into the image, and the execute bit comes from the checkout (git ignores
a hook without `+x` — silently — which is why `index.codex-mcp-server.test.ts`
asserts the bit). The gitconfig file is rendered from the TypeScript table
(`renderCodexGitGuardGitconfig`) and the test asserts the committed file equals
the render, so there is one source of truth.

The child's process env is not what codex hands the shell commands it runs:
that env goes through `shell_environment_policy`, which `~/.codex/config.toml`
— a writable group-state mount — can narrow. So the pairs are also forced on
the command line, where `-c` beats config.toml:
`shell_environment_policy.include_only=[]` (an `include_only` in config.toml is
applied *after* `set` and would drop every `GIT_CONFIG_*` silently — git would
then run unguarded, with no error anywhere) and
`shell_environment_policy.set.<NAME>="<value>"` for each pair (applied after
`exclude`; without it `ignore_default_excludes=false` strips `GIT_CONFIG_KEY_n`
alone through the `*KEY*` default exclude and every git command dies on the
dangling COUNT). This is load-bearing, not belt-and-braces. Verified with
`codex sandbox /usr/bin/env` on codex 0.151.0 and the pinned 0.146.0.
`envInherit` (the names-only secret allowlist) is unchanged. The Claude
session's own git never sees any of this: the pairs are in the MCP child's env,
not the container's.

**Holes, stated plainly.**

- **File writes.** `danger-full-access` is a real filesystem; codex can still
  edit a worktree. The skill tells the caller to re-hash the artifacts it
  passed (`### Attested`) and treat a mismatch as a codex write.
- **Pushes that never touch git.** A token plus `api.github.com` (`gh api`,
  `curl`) can update a ref or open a PR without `git push`. Credential scope
  in OneCLI is the control for that, not this guard.
- **Same-scope overrides on the network side.** `git -c protocol.https.allow=always
  -c core.hooksPath=/dev/null push …`, `--config-env=core.hooksPath=VAR`, a
  hand-set `GIT_CONFIG_PARAMETERS`, or `-c url.<longer-base>.pushInsteadOf=…`
  (longest match wins) are parsed after the env pairs at the same scope and
  win. A *local-path* push that does this still hits the `GIT_CONFIG_SYSTEM`
  backstop on the receive-pack side — unless the target repo's own config sets
  `core.hooksPath` (repo scope beats system). `env -u GIT_CONFIG_COUNT -u
  GIT_CONFIG_SYSTEM git …` drops the guard entirely. This guards a confused
  reviewer, not an adversary — the same standing as layers 3–4 above.
- **Branch switches on git < 2.46.** The image is `node:22-slim` (Debian
  bookworm, git 2.39). There, HEAD symref writes — `checkout <existing-branch>`,
  `switch`, `symbolic-ref HEAD …`, `worktree add <path> <existing-branch>` —
  are not ref transactions and are expected to go through: they move the
  builder worktree's HEAD (so the *builder's* next commit lands on another
  branch) but rewrite no history. On git ≥ 2.50 they are refused, as the
  proof shows. Run `scripts/prove-codex-git-guard.sh` inside the image before
  relying on either behaviour.
- **Transport reads are blocked too.** `git fetch`, `ls-remote`, `clone` and
  `submodule update` fail under `protocol.allow=never`. Acceptable for a
  reviewer; `fetch` was refused by the hooks anyway.
- **Codex itself** issues no ref-writing git commands on 0.146.0/0.151.0
  (`codex features list` reports `codex_git_commit` and `undo` as `removed`),
  so the hooks fire only on commands the model runs. If a future codex re-adds
  one, the refusal surfaces as that tool call failing — re-check with `codex
  features list` on upgrade.

Proof against a real git: `scripts/prove-codex-git-guard.sh` builds a
throwaway repo, exports the same env with `core.hooksPath` and
`GIT_CONFIG_SYSTEM` pointed at this checkout's
`container/hooks/codex-git-guard`, and shows every write refused — including
the explicit-pushurl, scp-style, alias, bare-relative and `-c`-bypass shapes —
while `log`/`status`/`diff`/`show`/`blame` succeed.

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
