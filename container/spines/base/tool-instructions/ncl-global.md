## `ncl` — NanoClaw CLI (global scope)

`ncl` is the NanoClaw admin CLI. From the host shell it uses a Unix socket; from inside a container it talks to the host via session DBs. Same flag interface in both places.

Your scope is **`global`** — unrestricted. You can read and modify **any** agent group, messaging group, wiring, user, role, destination, or session in this install. Treat that responsibility carefully.

### Resources you control

| Resource | Verbs | What it is |
|---|---|---|
| `groups` | `list`, `get`, `create`, `update`, `delete`, `restart`, `config get/update`, `config add-mcp-server/remove-mcp-server`, `config add-package/remove-package` | Agent groups — workspace, personality, container config. |
| `messaging-groups` | `list`, `get`, `create`, `update`, `delete` | A single chat/channel on one platform. |
| `wirings` | `list`, `get`, `create`, `update`, `delete` | Links a messaging group → an agent group. |
| `users` | `list`, `get`, `create`, `update` | Platform identities (`<channel>:<handle>`). |
| `roles` | `list`, `grant`, `revoke` | Owner / admin privileges (global or per-group). |
| `members` | `list`, `add`, `remove` | Unprivileged group access gate. |
| `destinations` | `list`, `add`, `remove` | Where an agent group can send messages. |
| `sessions` | `list`, `get`, `messages` | Active sessions (read-only). |
| `user-dms`, `dropped-messages`, `approvals` | `list`, `get` | Diagnostic views (read-only). |

### Common patterns

```bash
ncl groups list                                       # every agent group in this install
ncl groups config update --id <gid> --provider codex  # admin-approval-gated
ncl groups restart --id <gid> --rebuild               # rebuild image + respawn
ncl wirings create --messaging-group <mg> --agent-group <ag>
ncl roles grant --user <uid> --role admin --agent-group <gid>
ncl sessions messages <sid>                           # read any session's transcript
```

`ncl <resource> help` and `ncl help` print the full surface. Mutating verbs trigger admin approval just like the MCP self-mod tools.

### Cross-group operations

Unlike group-scoped coworkers, you can act across groups — wire two coworkers together, grant a role on someone else's group, restart a peer's container. Use this only when the user explicitly asks you to act on another group; otherwise default to working inside your own scope.
