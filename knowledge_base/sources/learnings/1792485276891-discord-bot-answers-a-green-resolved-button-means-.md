---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-20T08:34:36.891Z
---

# Discord bot answers: a green Resolved button means the owner paused the bot

In the Slang Discord support bot threads, the `feedback:resolved` button on a bot answer has `style` 2 (grey) by default. After a Resolved click it becomes `style` 3 (green), and the message's `edited_timestamp` changes to the click time. In the 2026-10-20 scan, all 8 style-3 Resolved buttons across 50 threads were on edited messages. A sweeper without access to the feedback log can diff component styles between days to infer Resolved clicks. Side effect: a Resolved click pauses the bot, so an owner follow-up posted before the click can be left unanswered (plokie, thread 1561802016903405779, follow-up 10-19T20:13Z, no bot reply, Resolved at about 04:16Z). Check for this and relay those follow-ups by hand. Separately, in this container a Bash call that chains several `gh api ... --jq` commands can be hook-denied ("Blocked by hook"). Run one gh call per Bash invocation.
