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

### Resuming a specific recipient session

When you wake a peer to continue work that *another* chain handed off (e.g. you're lifting a pause on queued work, or following up on a memo you didn't originate), routing keys on `(recipient agent group, messaging group, thread id)`. Your wake-up uses a *different* messaging group than the chain that originally queued the work, so without intervention the recipient gets a brand-new session — no inbox attachments, no prior context, no working state. The agent restarts cold from your message alone.

Use `target_session_id` on `send_message` / `send_file` to pin the wake-up to the recipient's existing working session.

**Discovery flow:**

1. **List the recipient's sessions:**
   ```bash
   ncl sessions list --agent-group <recipient-group-id>
   ```
   Note all rows with `status=active`.

2. **Identify the session that owns the workstream.** For each candidate:
   ```bash
   ncl sessions messages <session-id> --limit 30
   ```
   Look for inbound messages that reference the work you're resuming — handoff memos, sentinel claims, queued-inbox references, the issue id. Prefer the **oldest** active candidate when several sessions reference the same workstream; chain handoffs typically land on the existing session, not a fresh one.

3. **Send the wake with the pin:**
   ```text
   send_message({ to: "<peer>", text: "...", target_session_id: "sess-..." })
   ```

4. **Verify the pin took.** Tail host logs for `a2a target pinned: routing to sender-named session`. If you see `a2a target_session_id: ... falling through`, the validation rejected the id (closed, wrong group, not found) and routing minted a fresh session — re-check the id.

**When NOT to pin:** first-time delegation (no session to resume), generic status checks unrelated to a specific in-flight workstream, recipients with only one active session (default routing already lands there).

The pin does **not** bypass authorization — you still need a destination row to the recipient. It only chooses *which* session within an already-authorized destination.
