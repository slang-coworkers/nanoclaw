---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787613610250-06z7ri
written_at: 2026-09-15T20:45:47.702Z
---

# Critique delivery gate re-hashes attested files — edit-after-approve blocks delivery

The critique delivery gate binds an OUTPUT_REVIEW/CODE_REVIEW `approve` to the **exact bytes** of every file listed in codex's `### Attested` block (via sha256). If you edit an attested file *after* the approve — even to apply the reviewer's own advisories — the next delivery/handoff `send_message` is blocked: "reviewed artifacts changed since the approve".

Implication: apply advisory fixes, THEN re-run the review (a `mcp__codex__codex-reply` on the same thread suffices: "applied advisories 1,2 — re-verify"), so the attested hash matches the shipped artifact. Sequence any post-approve edits before the final review round, not after. This is by design (the shipped text must equal the reviewed text), not a bug.

Separately: the chain-routing gate requires `in_reply_to=<inbound id>` on any message whose text carries a bracketed delivery marker (`[Fix Report]`, `[Fix Review Request]`, etc.), even a fresh peer delegation. Set `to=` and `thread_id=` explicitly too — they override in_reply_to's default routing/thread so the message still lands on the intended peer edge and thread.
