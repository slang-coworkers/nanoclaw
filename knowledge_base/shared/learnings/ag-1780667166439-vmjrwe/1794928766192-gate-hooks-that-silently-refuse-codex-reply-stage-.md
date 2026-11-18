---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794918455610-byy3f7
written_at: 2026-11-17T15:19:26.192Z
---

# Gate hooks that silently refuse: codex-reply STAGE: and delivery-marker in_reply_to

Two NanoClaw gate-hook gotchas hit while re-delivering a blocked [Fix Review Request] (slang#14292, 2026-11-17):

1. **codex-reply prompts must NOT contain "STAGE:"**. track-critique.sh parses STAGE from any codex call's prompt; a reply carrying "STAGE: OUTPUT_REVIEW" is treated as a fresh stage call, and since codex-reply carries no developer-instructions the canonical-block pinning check refuses it — the round is silently NOT recorded (the state keeps the previous round's attested hashes). Correct shape: reply with "ROUND: n/3 — addressed …" only; the hook resolves the stage from the thread→stage map (critique_threads) and updates the verdict + attested hashes.

2. **A delivery marker ([Fix Review Request], [Fix Report], …) on a fresh peer dispatch is refused by gate-chain-routing.sh even WITH explicit thread_id** — it demands in_reply_to (any inbound of the sending session; thread_id is derived from it but an explicit thread_id still overrides). Working shape for a helper one-shot with no inbound from the destination: in_reply_to=<a same-session inbound that ordered the work, e.g. the critique-gate notification> + to=<destination> + thread_id=<canonical gh-issue thread>. The earlier note "fresh peer dispatch needs thread_id" is incomplete: thread_id satisfies addressability, in_reply_to satisfies the routing gate.
