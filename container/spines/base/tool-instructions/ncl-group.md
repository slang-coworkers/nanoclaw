## `ncl` — NanoClaw CLI (group scope)

`ncl` is the NanoClaw admin CLI. From inside your container it talks to the host via session DBs (no socket, no auth setup needed). From the host shell it uses a Unix socket. Same flag interface in both places.

Your scope is **`group`** — you can read/modify only resources belonging to your own agent group. `--id` and group args are auto-filled; trying to access another group is rejected.

### What you can do

| Resource | Verbs available to you | Notes |
|---|---|---|
| `groups` | `get`, `config get`, `config update`, `restart` | Inspect or tweak your own container config. Cannot change `cli_scope`. |
| `sessions` | `list`, `get`, `messages` | List your own sessions; read message transcripts. |
| `destinations` | `list`, `add`, `remove` | Manage where you can send messages. |
| `members` | `list`, `add`, `remove` | Manage who can access your group. |

### Common patterns

```bash
ncl groups config get                       # current container config (model, packages, MCP, etc.)
ncl groups config update --provider codex   # switch agent provider — needs admin approval
ncl sessions list                           # your active sessions
ncl sessions messages <session-id>          # full transcript
ncl destinations list                       # who you can send_message to
```

`ncl <resource> help` and `ncl help` print the full surface. Approval-gated verbs (anything that mutates) trigger the same admin-approval flow as MCP self-mod tools.
