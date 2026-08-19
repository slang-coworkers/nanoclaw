## `ncl` — NanoClaw CLI (global scope)

`ncl` is the NanoClaw admin CLI. Same flag interface on the host (Unix socket) and inside a container (session DBs).

Your scope is **`global`** — unrestricted. You can read and modify any agent group, messaging group, wiring, user, role, destination, or session. Treat that carefully.

### Resources you control

| Resource                                    | Verbs                                                                                                                                                       | What it is                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `groups`                                    | `list`, `get`, `create`, `update`, `delete`, `restart`, `config get/update`, `config add-mcp-server/remove-mcp-server`, `config add-package/remove-package` | Agent groups — workspace, personality, container config. |
| `messaging-groups`                          | `list`, `get`, `create`, `update`, `delete`                                                                                                                 | A single chat/channel on one platform.                   |
| `wirings`                                   | `list`, `get`, `create`, `update`, `delete`                                                                                                                 | Links a messaging group → an agent group.                |
| `users`                                     | `list`, `get`, `create`, `update`                                                                                                                           | Platform identities (`<channel>:<handle>`).              |
| `roles`                                     | `list`, `grant`, `revoke`                                                                                                                                   | Owner / admin privileges (global or per-group).          |
| `members`                                   | `list`, `add`, `remove`                                                                                                                                     | Unprivileged group access gate.                          |
| `destinations`                              | `list`, `add`, `remove`                                                                                                                                     | Where an agent group can send messages.                  |
| `sessions`                                  | `list`, `get`, `messages`                                                                                                                                   | Active sessions (read-only).                             |
| `cost-cap`                                  | `get`, `set`, `clear`                                                                                                                                       | Runtime Tier-2 cost-cap policy — fleet ceiling + per-group cap/ceiling overrides. **Global/elevated only.** |
| `user-dms`, `dropped-messages`, `approvals` | `list`, `get`                                                                                                                                               | Diagnostic views (read-only).                            |

### Common patterns

```bash
ncl groups list
ncl groups config update --id <gid> --provider codex     # admin-approval-gated
ncl groups restart --id <gid> --rebuild
ncl wirings create --messaging-group <mg> --agent-group <ag>
ncl roles grant --user <uid> --role admin --agent-group <gid>
ncl sessions messages <sid>
```

`ncl <resource> help` / `ncl help` print the full surface. Mutating verbs trigger admin approval, like the MCP self-mod tools.

### Tuning the cost cap

The Tier-2 cost cap is configured at runtime through `ncl cost-cap` — this is the mechanism, **not** the `NANOCLAW_COST_T2_CEILING_USD` env var (a deprecated legacy fallback). Values are stored in the DB and read at each container spawn; a `set`/`clear` change takes effect on a group's next spawn (`ncl groups restart --id <gid>` to apply immediately).

```bash
ncl cost-cap get                                # effective fleet ceiling + every override
ncl cost-cap get --group <folder>               # a group's effective per-session cap + ceiling
ncl cost-cap set --ceiling 150                  # fleet-wide Tier-2 hard ceiling (USD)
ncl cost-cap set --ceiling 300 --group <folder> # per-group ceiling override
ncl cost-cap set --cap 60 --group <folder>      # per-group per-session cap (requires --group)
ncl cost-cap clear [--group <folder>]           # remove an override → env/thresholds fallback
```

`--group <folder>` is the group's workspace folder. This surface is elevated-only (global scope / host operator); group-scoped agents can't reach it.

### Cross-group operations

You can act across groups, but only when the user explicitly asks you to act on another group; otherwise default to your own scope.

### Resuming a specific recipient session

When you wake a peer to continue work _another_ chain handed off, routing keys on `(recipient agent group, messaging group, thread id)`. Your wake uses a different messaging group than the chain that dispatched the work, so without intervention the recipient gets a fresh session — no inbox, no context. Use `target_session_id` on `send_message` / `send_file` to pin the wake to the recipient's existing session.

**Discovery flow:**

1. List candidates: `ncl sessions list --agent-group <recipient-group-id>` — note rows with `status=active`.
2. Identify the owning session: `ncl sessions messages <session-id> --limit 30`; look for inbound messages referencing the work (handoff memos, sentinel claims, issue id). Prefer the **oldest** active candidate when several match.
3. Send the wake pinned: `send_message({ to: "<peer>", text: "...", target_session_id: "sess-..." })`.
4. Verify: tail host logs for `a2a target pinned: routing to sender-named session`. `a2a target_session_id: ... falling through` means the id was rejected (closed, wrong group, not found) and a fresh session was minted — re-check the id.

**Don't pin** for first-time delegation, generic status checks, or recipients with one active session (default routing already lands there).

The pin does **not** bypass authorization — you still need a destination row to the recipient. It only chooses which session within an authorized destination.
