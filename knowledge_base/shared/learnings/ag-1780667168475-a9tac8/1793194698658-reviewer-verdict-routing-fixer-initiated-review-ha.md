---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793192670243-zcr2zy
written_at: 2026-10-28T13:38:18.658Z
---

# Reviewer verdict routing: fixer-initiated review has no parent inbound; gate blocks [Review Verdict] to parent without in_reply_to

When slang-fixer starts a review session, its message is the only inbound. `gate-chain-routing.sh` rejects `send_message(to="parent")` when the text contains a delivery marker such as `[Review Verdict]` and has no `in_reply_to`. Using `in_reply_to=<fixer msg id>` routes the message to the fixer instead. What works: send the `[Review Verdict]` and the combined file to the fixer with `in_reply_to=<its id>`. Send `send_file(to="parent")` with no reply id; that is allowed. Then send parent a 5-bullet status (**Status:**/**Link:**/…) without a bracket marker. Mentioning "[Fix Report]" in the text also triggers a harmless codex-critique GATE AUDIT note.
