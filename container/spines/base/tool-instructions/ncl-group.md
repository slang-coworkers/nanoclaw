## `ncl` — NanoClaw CLI (group scope)

`ncl` is the NanoClaw admin CLI; inside your container it talks to the host through the session DBs (no socket, no auth setup). Your scope is **`group`**: you read and modify only your own group's resources, `--id` and group arguments are auto-filled, and another group's resources are rejected.

| Resource       | What you can do with it                                             |
| -------------- | ------------------------------------------------------------------- |
| `groups`       | inspect or tweak your own container config (not `cli_scope`)        |
| `sessions`     | list your sessions, read transcripts                                |
| `destinations` | where you can send messages                                         |
| `members`      | who can access your group                                           |
| `wirings`      | engagement for this conversation only                               |
| `tasks`        | your scheduled tasks — list, create, update, cancel, pause, run     |
| `pr-mappings`  | which PR routes to which of your sessions                           |

Mutating verbs are approval-gated like the MCP self-mod tools: `wirings` `update` needs human approval; task mutations do not. Verbs, command examples and the task gate-script contract are in `/base-nanoclaw` › `ncl` surface; `ncl help` and `ncl <resource> help` print the full surface.
