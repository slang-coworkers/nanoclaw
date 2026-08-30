## `ncl` — NanoClaw CLI (group scope)

`ncl` is the NanoClaw admin CLI. Inside your container it talks to the host via session DBs (no socket, no auth setup); from the host shell it uses a Unix socket. Same flag interface both places.

Your scope is **`group`** — you read/modify only resources in your own agent group. `--id` and group args are auto-filled; accessing another group is rejected.

### What you can do

| Resource       | Verbs available to you                          | Notes                                                                  |
| -------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| `groups`       | `get`, `config get`, `config update`, `restart` | Inspect or tweak your own container config. Cannot change `cli_scope`. |
| `sessions`     | `list`, `get`, `messages`                       | List your own sessions; read transcripts.                              |
| `destinations` | `list`, `add`, `remove`                         | Manage where you can send messages.                                    |
| `members`      | `list`, `add`, `remove`                         | Manage who can access your group.                                      |
| `wirings`      | `get`, `update`                                 | Tune engagement for THIS conversation only: engage_mode / engage_pattern. |

### Common patterns

```bash
ncl groups config get                       # current container config (model, packages, MCP, etc.)
ncl groups config update --provider codex   # switch agent provider — needs admin approval
ncl sessions list                           # your active sessions
ncl sessions messages <session-id>          # full transcript
ncl destinations list                       # who you can send_message to
ncl wirings update --engage-mode mention    # change when you engage in this chat
```

`ncl <resource> help` and `ncl help` print the full surface. Mutating (approval-gated) verbs trigger the same admin-approval flow as MCP self-mod tools.
