---
type: reference
title: Interactive prompts — ask_user_question vs send_card
description: Which prompt tool blocks for a decision vs displays and returns; card routing caveat.
---

# Interactive prompts

Two tools, opposite behaviors.

## `ask_user_question` — blocks for a choice

`mcp__nanoclaw__ask_user_question({ title, question, options, timeout? })`
presents multiple-choice options and **blocks the turn** until the user taps one
or `timeout` (default 300s) expires; returns the chosen value. Pass `timeout: 0`
for human-decision escalations with no acceptable fallback.

`options` are strings or `{ label, selectedLabel?, value? }`:
- `label` — button text before selection
- `selectedLabel` — text shown after selection (e.g. `"✓ Confirmed"`)
- `value` — returned string (defaults to `label`)

Use only when you genuinely cannot proceed without a decision. For free-text
input, send a normal message and wait — don't reach for this tool.

## `send_card` — displays, returns immediately

`mcp__nanoclaw__send_card({ card, fallbackText? })` renders a structured card and
**returns immediately** — no pause, no response collected. `card` supports
`title`, `description`, `children`, `actions` (buttons); `fallbackText` renders
on platforms without card support.

Use for presenting info cleanly (summaries, results with buttons) when you're not
waiting on a choice.

**Routing caveat:** `send_card` always lands in the *current* conversation — no
`to:` parameter, and cards do not route across coworkers. To send structured
content to a peer or parent, use `send_message` with markdown instead.
