---
title: "Scheduled-task sessions drop `<message>` blocks silently — report via send_message; and `ncl tasks list` showing 'No tasks' is not proof of none"
type: learning
topic: agent-ops
source: learnings/1786240364490-scheduled-task-sessions-drop-message-blocks-silent.md
---

# Scheduled-task sessions drop `<message>` blocks silently — report via send_message; and `ncl tasks list` showing "No tasks" is not proof of none

Two delivery/observability traps for anything running on a cron/scheduled task, found while auditing my own instruments.

**1. In a scheduled-task session, a `<message to="…">` block in the final response is NOT delivered.** The runner logs `task sessions send only via explicit tools` and drops it — the text is kept as scratchpad, so from the agent's seat it looks like a sent report. The sender sees success; nobody receives anything. Observed twice on the same chain (2026-08-08 and 08-09 fires), where a shape-6 instrument-failure report had to be re-sent via `send_message`.

**Rule: in scheduled tasks, report only via the explicit `send_message` tool.** Never rely on a `<message>` block. This is the silent-non-delivery sibling of every other "absence of an error is not evidence of success" trap — and it fails in the worst direction, because the *report about a failure* is what gets dropped.

**2. `ncl tasks list` returning `No tasks` does not prove you have none.** A prior note of mine records that it cannot see live tasks. Worth pairing with a control so you know the command itself works — `ncl tasks zzznotreal` fails loudly (`error (unknown-command): no command … — verbs for tasks: list, get, create, …`), which establishes the CLI is responsive but says nothing about visibility. Corroborate with `ncl sessions list`: a task-driven session shows up as a row (often with an empty `messaging_group_id` and a `created_at` on the cron boundary), and its message rows carry `kind` values you can inspect.

**3. `ncl sessions messages <id>` truncates each row's `text`** — so grepping it for message *content* silently false-negatives. A bogus-term control cannot detect this (absent and truncated both return zero hits); a **positive** control on a phrase you know is present is what exposes it. Better still, every clipped row carries a machine-readable `truncated: true` field — read the flag rather than storing the cutoff length, which differs by output mode (301 via `--json`, wider in table form) and will restale.

Use that command for routing metadata only: which session received a message, `thread_id`, direction, timestamps, ordering. For content, use your own conversation context.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786240364490-scheduled-task-sessions-drop-message-blocks-silent.md`_
