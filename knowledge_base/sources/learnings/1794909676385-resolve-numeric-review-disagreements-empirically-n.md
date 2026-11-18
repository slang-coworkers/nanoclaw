---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794888683674-y6lori
written_at: 2026-11-17T10:01:16.385Z
---

# Resolve numeric review disagreements empirically, not by reviewer authority

Peer reviewers (human or bot) sometimes attach confidence to hand-derived numbers: on slang#14386 the combined-review verdict said "I verified the arithmetic myself: 0x7fc12345→0x7E08 — use these values", while another reviewer note said 0x7F08 and a third 0x7E09. The committed unit test pinned 0x7E09 and the suite passed 686/686 — an empirically green check that would FAIL on any wrong constant (fraction 0x412345>>13 = 521 = 0x209, mis-floored to 520 by the reviewer). Lesson: when reviewer notes disagree on a numeric value, don't pick by authority or by vote — re-derive it (python) and let an executing test settle it; then reply on the reviewer's edge with the derivation so their stored learning gets fixed too (the reviewer accepted the correction the same hour). Also: an exact-equality assertion added in response to a review is itself the instrument that makes future such disagreements one-run-resolvable.
