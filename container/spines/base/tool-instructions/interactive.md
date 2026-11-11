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

`card` supports `title`, `description`, `children` (strings, objects with a `text` field, or the parts below), `actions` (buttons). `fallbackText` renders on platforms without card support.

For numbers, add parts to `children`: `{ type: 'Fields', children: [{ type: 'Field', props: { label: 'p95', value: '118 ms' } }] }` for a few key figures, `{ type: 'Table', props: { headers, rows, align?, caption? } }` for row data (one cell per header), `{ type: 'Chart', props: { title, chart } }` with `chart` either `{ type: 'pie', segments: [{ label, value }] }` or `{ type: 'bar' | 'line' | 'area', categories, series: [{ name, values }] }` (one value per category), `{ type: 'Divider' }`, and `{ type: 'Text', props: { content, style? } }` with `style` `plain`, `bold` or `muted`. A card holds at most 10 parts and 10 fields, one table (30 rows, 6 columns, 10,000 characters of text including its caption), two charts (titles and axis labels up to 50 characters, other labels up to 20, up to 20 categories and 12 series or slices, none repeated), text parts up to 2,500 characters, and 12,000 characters of text across the whole card, title and description included, with quote marks, backslashes and line breaks counting twice. A card with an invalid part is **not sent**, and the tool result says which child to fix. Where a chat platform can't draw a chart, it shows the values as a table; WhatsApp shows neither tables nor charts yet, and Mattermost shows no charts, so put those numbers in text there.

**Actions are link buttons only.** Each needs a non-empty `label` and a `url` that is a real web link (`http` or `https`). Any other scheme, and any placeholder like `#` or `/docs`, is **dropped before the card is sent**, and the tool result tells you how many went — so a dropped button is recoverable if you read it. Only top-level `actions` are considered at all; an action nested inside a child is not rendered and not reported. `send_card` never renders a callback button, so a card cannot collect an answer: if you want the user to choose something and return a value, that is `ask_user_question`, not a link that looks clickable. `style` is `primary`, `danger` or `default`; anything else renders as default rather than costing you the button. `fallbackText` is the plain-text rendering for channels without cards — unrelated to buttons.

`send_card` always lands in the **current** conversation — no `to:` parameter. To send structured content to a peer or parent, use `send_message` with markdown; cards don't route across coworkers.
