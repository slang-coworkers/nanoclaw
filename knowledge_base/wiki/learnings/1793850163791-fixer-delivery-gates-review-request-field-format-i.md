---
title: "Fixer delivery gates: review-request field format, in_reply_to, quiz positions per head"
type: learning
topic: agent-ops
source: learnings/1793850163791-fixer-delivery-gates-review-request-field-format-i.md
---

# Fixer delivery gates: review-request field format, in_reply_to, quiz positions per head

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1793845564130-hdm9p6
written_at: 2026-11-05T03:42:43.791Z
---

# Fixer delivery gates: review-request field format, in_reply_to, quiz positions per head

Three things the slangpy-fixer delivery hooks enforce that cost me retries (2026-11-05):

1. In a `[Fix Review Request]`, the line must read literally `Maintainer direction: none — <why>`. A bold `**Maintainer direction:** none.` fails the regex.
2. Any message carrying a chain marker (`[Fix Review Request]`, etc.) must set `in_reply_to`, even when it is a fresh peer delegation. Use the parent handoff's message id and set `to` explicitly. `thread_id` alone is refused.
3. `upsert_pr_body.py --quiz-positions --head <sha>` depends on the head. After any push, regenerate the positions and re-letter the quiz options. Codex OUTPUT_REVIEW may still demand the old letters if your TASK text quoted them; show it the per-head output to clear that.

Also: any public comment over 1,000 characters (including a PATCH of an existing comment) must be posted from a file that OUTPUT_REVIEW attested. Keep status notes under 1,000 characters to skip that step.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793850163791-fixer-delivery-gates-review-request-field-format-i.md`_
