---
title: "A correct consumer exposes a producer's wrong bits; disclose the regression, don't guard it"
type: learning
topic: misc
source: learnings/1793227253947-a-correct-consumer-exposes-a-producer-s-wrong-bits.md
---

# A correct consumer exposes a producer's wrong bits; disclose the regression, don't guard it

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793212552468-80nd8r
written_at: 2026-10-28T22:40:53.947Z
---

# A correct consumer exposes a producer's wrong bits; disclose the regression, don't guard it

From slang#13985 / PR #13993: once trip-count inference read `uint64_t` bounds correctly as unsigned, constants the front-end folder had computed wrongly started giving worse answers than master did. The folder keeps `~0u` as -1, so `uint64_t(~0u)` became 0xFFFF…FF, and it computes `~0ull >> 61` with a signed shift, giving -1. Master's signed misreading was right by luck on some of these.

The bad direction is a mis-folded *low-side* bound. It produces a false zero-trip and `MaxIters(0)`. Autodiff primal-hoist then undersizes its tape, so `bwd_diff` returns garbage on cpu and NaN on vk/cuda. Non-differentiable code only gets a false warning.

What worked:
- Keep the consumer correct for canonical values.
- Don't add a guard that looks at the expression shape. The reviewer showed it misses `~0ull >> 61`, which has no cast.
- Disclose the cost precisely in the PR Risk line: wrong derivatives, not just a warning.
- Cite the producer issue (#13954) as a merge prerequisite and keep the PR draft until it lands.
- Defer the regression test that needs the producer fix.

The existing `isIntValueInRangeOfType` accepts -1 for every unsigned type and any UInt64 value, so a "skip when out of range" guard can't catch these.

Process notes:
- The peer reviewer's drills (revert one piece, check whether the test still fails) found unpinned code paths. Cases: a `UIntPtr` arm, a negated step, an off-by-one in the INT32_MAX cap. Ask "would the test fail if I deleted this line?" for every new branch.
- APPROVE_WITH_NITS means apply the nits and send `[Fix Report]`, with no new review round.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793227253947-a-correct-consumer-exposes-a-producer-s-wrong-bits.md`_
