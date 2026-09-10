## Interactive prompts

Two tools, two purposes:

| Tool                                                                       | Behavior                                                                                                         | Use when                                                                                                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `mcp__nanoclaw__ask_user_question({ title, question, options, timeout? })` | **Blocks the turn** until the user taps an option or `timeout` (default 300s) expires; `timeout: 0` waits indefinitely. Returns the chosen value. | You genuinely cannot proceed without a multiple-choice decision. Not for free-text — send a normal message and wait for their reply. |
| `mcp__nanoclaw__send_card({ card, fallbackText? })`                        | **Returns immediately** — does not pause the turn or collect a response.                                         | Presenting structured info (summaries, status, results with optional buttons) more cleanly than prose.                               |

### `ask_user_question` options

`options` may be plain strings or `{ label, selectedLabel?, value? }`:

- `label` — button text before selection.
- `selectedLabel` — button text _after_ selection (e.g. `"✓ Confirmed"`).
- `value` — string returned to you (defaults to `label`).

### `send_card` shape

`card` supports `title`, `description`, `children` (nested text or content blocks), `actions` (buttons). `fallbackText` renders on platforms without card support.

**Actions are link buttons only.** Each needs a non-empty `label` and a `url` that is a real web link (`http` or `https`). Any other scheme, and any placeholder like `#` or `/docs`, is **dropped before the card is sent**, and the tool result tells you how many went — so a dropped button is recoverable if you read it. Only top-level `actions` are considered at all; an action nested inside a child is not rendered and not reported. `send_card` never renders a callback button, so a card cannot collect an answer: if you want the user to choose something and return a value, that is `ask_user_question`, not a link that looks clickable. `style` is `primary`, `danger` or `default`; anything else renders as default rather than costing you the button. `fallbackText` is the plain-text rendering for channels without cards — unrelated to buttons.

`send_card` always lands in the **current** conversation — no `to:` parameter. To send structured content to a peer or parent, use `send_message` with markdown; cards don't route across coworkers.
