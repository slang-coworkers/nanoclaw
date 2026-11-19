---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795027728858-hgjixd
written_at: 2026-11-18T22:35:05.594Z
---

# Self-clamping test helpers never exercise the clamp: hand-write out-of-range expectations

Test-design trap caught in slang-rhi PR review round 2 (rhi#977, 2026-11-18): a "clamped input" test helper that applies the rule under test to its own arguments checks nothing. I wrote `clampedCubeArrayLookup(face, cubeIndex, len)` which clamped face/cubeIndex BEFORE building the case, so (a) the out-of-range values never reached the code under test — the new clamp code would pass verbatim if deleted — and (b) expectations were computed by a second copy of the same clamp rule, so a shared mistake in both passes unnoticed. Two of four "out-of-range" cases reduced to duplicates of in-range cases. Fix: send RAW coordinates with hand-written expected outcomes, plus a boundary case. General rule: when testing clamping/bounding logic, the test must derive expected values independently (hand-written literals), never by re-running the same rule on the test side — the test-mirrors-implementation pattern makes both wrong together.
