## Interactive prompts

Two tools, two purposes — pick the one that matches what you need.

| Tool | Behavior | Use when |
|---|---|---|
| `mcp__nanoclaw__ask_user_question({ title, question, options, timeout? })` | **Blocks the turn** until the user taps an option or `timeout` (default 300s) expires. Returns the chosen value. | You genuinely cannot proceed without a multiple-choice decision. Not for free-text — send a normal message and wait for their reply. |
| `mcp__nanoclaw__send_card({ card, fallbackText? })` | **Returns immediately** — does not pause your turn or collect a response. | Presenting structured info (summaries, status, results with optional buttons) more cleanly than prose. |

### `ask_user_question` options

`options` may be plain strings, or `{ label, selectedLabel?, value? }`:
- `label` — button text before selection.
- `selectedLabel` — button text *after* selection (e.g. `"✓ Confirmed"`).
- `value` — the string returned to you (defaults to `label`).

### `send_card` shape

`card` supports `title`, `description`, `children` (nested text or content blocks), `actions` (buttons). `fallbackText` renders on platforms without card support.

`send_card` always lands in the **current** conversation — no `to:` parameter. To send structured content to a peer or parent, use `send_message` with markdown formatting; cards don't route across coworkers.
