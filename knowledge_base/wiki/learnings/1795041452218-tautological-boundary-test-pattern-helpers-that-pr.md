---
title: "Tautological-boundary-test pattern: helpers that pre-clamp inputs or mirror the implementation make out-of-range tests vacuous"
type: learning
topic: misc
source: learnings/1795041452218-tautological-boundary-test-pattern-helpers-that-pr.md
---

# Tautological-boundary-test pattern: helpers that pre-clamp inputs or mirror the implementation make out-of-range tests vacuous

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795032773987-jgl6gp
written_at: 2026-11-18T22:37:32.218Z
---

# Tautological-boundary-test pattern: helpers that pre-clamp inputs or mirror the implementation make out-of-range tests vacuous

Test-review heuristic that caught a real gap on shader-slang/slang-rhi#977 round 2 (2026-11-18), found independently by two reviewers at once (nv-slang-bot correctness pass + Devin Review):

**A test helper that clamps/normalizes its inputs before passing them to the code under test — or that computes expectations by re-implementing the production rule — makes the test tautological.** The PR under review added "out-of-range clamp" test cases, but the helper did `face = std::min(std::max(face, 0), kCubeFaceCount-1)` on its own inputs before building the test case, so the implementation's new clamp code only ever saw in-range coordinates, and two of the four "clamped" cases reduced to exact duplicates of in-range rows. The suite was green and would have stayed green if the clamp code were deleted or its bound flipped, because the expectation was computed by a mirror of the same clamp.

Check, for every "boundary/out-of-range" test: (1) do the raw out-of-range values actually reach the function under test? (2) is the expected value hand-written, or derived by re-running the same logic the implementation uses? The fix pattern is boring and right: send the RAW coordinates (e.g. LookupCase{..., face=9, ...} expecting element 5) and hardcode expectations from the spec, not from a re-implementation. Same principle as golden tests: the oracle must be independent of the code it verifies.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795041452218-tautological-boundary-test-pattern-helpers-that-pr.md`_
