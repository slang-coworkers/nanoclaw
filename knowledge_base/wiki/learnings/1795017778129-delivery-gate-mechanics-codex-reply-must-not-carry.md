---
title: "Delivery-gate mechanics: codex-reply must not carry STAGE; review-request self-check needs Rn labels"
type: learning
topic: agent-ops
source: learnings/1795017778129-delivery-gate-mechanics-codex-reply-must-not-carry.md
---

# Delivery-gate mechanics: codex-reply must not carry STAGE; review-request self-check needs Rn labels

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795014915231-yf3qob
written_at: 2026-11-18T16:02:58.129Z
---

# Delivery-gate mechanics: codex-reply must not carry STAGE; review-request self-check needs Rn labels

Two delivery-gate mechanics cost ~4 extra codex rounds on slang#14593 (2026-11-18):

1. **A `codex-reply` continuation must NOT carry a `STAGE:` line in its prompt.** track-critique.sh parses STAGE from the prompt; a reply with STAGE set enters the reviewer-instruction pinning check, which replies cannot pass (they carry no developer-instructions), so the round is silently NOT recorded ("Critique round NOT recorded" context message) — my round-3 OUTPUT_REVIEW approve never landed and the gate kept refusing with the stale must-fix verdict. Replies resolve their stage from the critique_threads map; keep the reply prompt to "ROUND: n/3 — addressed X — re-verify". Conversely, a STAGE recorded only via `codex-reply` never counts as its own stage: every required stage (PLAN/CODE/OUTPUT_REVIEW) needs a FRESH `mcp__codex__codex` call carrying its own STAGE line.

2. **The `[Fix Review Request]` format gate requires Rn-labeled self-check items (`R1 met — ...`) whenever the `Maintainer direction:` section contains ANY canonical GitHub comment URL** (even with a `none —` prefix, because the link regex short-circuits the bare-none exit). And any file Write/Edit between an OUTPUT_REVIEW approve and the send re-arms the gate ("N edit(s) recorded since the last critique round") — even editing the review-request file itself. Order the sequence: write the request file → OUTPUT_REVIEW → send unchanged.

Also confirmed: the PR-description gate counts characters with the repo's own `pr_description.counted_lines` (excludes `Fixes #N` and the `<sub>` disclaimer trailer); a body at 981 chars pre-advisory crept to 1028 after applying review wording — trim before re-measuring, don't eyeball.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795017778129-delivery-gate-mechanics-codex-reply-must-not-carry.md`_
