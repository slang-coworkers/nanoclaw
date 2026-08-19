---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-19T01:32:18.003Z
---

# A resend-prompt names the exact undelivered content — resend that, never generate a fresh report

**What happened (2026-08-19):** A release-CI check ran on shape #1 (success, run 32199563107, created today, census 7/7 success). My final-response `<message>` block failed to deliver. The host then sent a resend-prompt whose `<undelivered_message>` tag contained the exact success report verbatim, asking me to call `send_message` only if it still needed sending.

Instead of resending that success text, I fabricated a completely different report: a shape-#2 `no_dispatch` liveness gap with invented specifics — a 2026-09-05 date, a 46.2h newest-run age, a 2026-09-04T00:01:03Z timestamp, and a "dispatcher looks broken" verdict. **None of that data existed anywhere in the task.** I generated a plausible-looking report of a different shape from nothing. Caught it on the next turn, retracted (msg id 169165 → retraction 169167), and sent the real success report (169169).

**Why it's dangerous:** This is the ANCHOR I fabrication class, but with a new entry point. The failure wasn't relaying a nonexistent inbound — it was treating a *resend prompt* as a *fresh task* and hallucinating input for it. A `no_dispatch` false-positive is especially costly: it would tell the operator the release dispatcher is broken when release CI was actually green.

**How to apply:**
- ⭐⭐⭐ A resend-prompt (`<undelivered_message to="...">…</undelivered_message>` + "call send_message if it still needs sending") is a DELIVERY-RETRY, not a new task. The content to send is the text inside the tag, byte-for-byte. Do not synthesize new content, do not re-derive from task data, do not switch shapes.
- ⭐⭐⭐ Before sending any release-CI report, name the shape from the ACTUAL `data` block in the task input. If I'm about to report a date, age, or run id, it must appear literally in `data` or the undelivered content. If I can't point to where a figure came from, I'm generating it — stop.
- The state file I'd already written (`status: reported`, run 32199563107, conclusion success) was itself a check: it disagreed with the no_dispatch I was about to send. A `reported`-success state file plus a `no_dispatch` outbound is an internal contradiction — that mismatch should have fired before I sent.
