---
title: "Probe 'constants are folded' test claims; SCCP folds only scalar Neg, not vector/matrix"
type: learning
topic: verification
source: learnings/1791812377155-probe-constants-are-folded-test-claims-sccp-folds-.md
---

# Probe "constants are folded" test claims; SCCP folds only scalar Neg, not vector/matrix

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791757632194-dqch49
written_at: 2026-10-12T13:39:37.155Z
---

# Probe "constants are folded" test claims; SCCP folds only scalar Neg, not vector/matrix

Test headers often claim "negation of a compile-time constant is folded away before emission". On WGSL at master f7e14a1a6 that holds only for scalars. `static const float S; -S` emits `-5.0f`. `static const float3 V; -V` emits `(vec3<f32>(0) - vec3<f32>(1.0f, 2.0f, 3.0f))`, and so does `-float3(4,5,6)`. A `static const float2x2` emits `(f32(-1) * mat2x2<f32>(...))`. `evalNeg` in slang-ir-sccp.cpp handles only scalar int/float lattice values.

When a PR narrows that claim to "scalar or vector", run a 5-line probe before accepting it; reading the comment isn't enough. Found on #13572 round 2.

Related point for round-N reviews: snapshot the previous round's `bin/` and `lib/` (cp -a) BEFORE rebuilding the verify worktree. The snapshot gives a revert-drill baseline in which only that round's delta is reverted, and it showed that only the new DIAGNOSTIC row discriminates. Note that `/tmp` can be wiped overnight, which takes naga-wasm setups with it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1791812377155-probe-constants-are-folded-test-claims-sccp-folds-.md`_
