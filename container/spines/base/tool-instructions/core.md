## Sending messages

| Pattern                                 | Syntax                                       | Routing                                                                                                      |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Reply to current sender                 | plain text, no wrapper                       | follows `session_routing` (host sets it to this turn's sender)                                               |
| Dispatch to a coworker                  | `<message to="<name>">…</message>`           | `<name>` must be in your destinations block; `wire_agents` first if two non-Main coworkers need peer-to-peer |
| Multiple destinations in final response | one `<message to="…">` block per destination | each routes independently                                                                                    |
| Internal scratchpad                     | `<internal>…</internal>`                     | not delivered                                                                                                |

**Hard rules:**

- **Never use your own group name as a `<message>` destination** — it loops back as a2a delegation, creating a duplicate bubble.
- **`<message>` blocks dispatch only from the final response.** Mid-turn `<message>` blocks are silently dropped — use `mcp__nanoclaw__send_message` for progress updates.

### Mid-turn updates (`send_message`)

`mcp__nanoclaw__send_message({ to?, text })` sends before the final output when work takes noticeable time. Pace to turn length:

- Short turn (1-2 tool calls): no narration.
- Long turn: one early ack ("On it, checking the logs"), then periodic updates at meaningful transitions — not every tool call.
- Before slow operations: a heads-up.

**Outcomes, not play-by-play.** Omit `to:` to follow `session_routing` like a plain reply.

### Pinning a specific recipient session (`target_session_id`)

`send_message` and `send_file` accept an optional `target_session_id`. When set, routing delivers to that exact session within the resolved destination — instead of letting the router pick by `(messaging group, thread)`, which mints a fresh session whenever the sender is on a different chain than the one that created the recipient's working session. Use it to wake a specific paused session whose context you want to resume (queued attachments, prior conversation, in-flight worktrees) rather than start cold.

The pin only narrows session selection within an already-authorized recipient — you still need a normal destination to that group. On any mismatch (session closed, belongs to a different group, doesn't exist), the host falls through to default routing and logs a warning. Omit the field for normal sends.

### Sending files (`send_file`)

`mcp__nanoclaw__send_file({ path, text?, filename?, to? })` — `path` is absolute or relative to `/workspace/agent/`. Use for artifacts (charts, PDFs, reports) instead of dumping contents into chat.

### Reacting (`add_reaction`)

`mcp__nanoclaw__add_reaction({ messageId, emoji })` — `messageId` is the numeric `#N` id (integer); `emoji` is a shortcode (`thumbs_up`, `heart`, `eyes`, `white_check_mark`). Lightweight ack when a full reply would be noise.
