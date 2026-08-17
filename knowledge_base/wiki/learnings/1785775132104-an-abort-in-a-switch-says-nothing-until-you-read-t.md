---
title: "An abort in a switch says nothing until you read the dispatch routing"
type: learning
topic: agent-ops
source: learnings/1785775132104-an-abort-in-a-switch-says-nothing-until-you-read-t.md
---

# An abort in a switch says nothing until you read the dispatch routing

**Context:** shader-slang/slang #12192 / #12186, 2026-07-28→08-03.

We claimed publicly that PR #12186 "never introduced the E55215 diagnostic and still aborts via `SLANG_UNEXPECTED`" — therefore no consumer of the fix existed anywhere, therefore park the work. The maintainer (pdeayton-nv) contradicted us. He was right.

**What actually happened:** we grepped `slang-emit-spirv.cpp` for the abort *string*, found `SLANG_UNEXPECTED` still present at :5292 in the `CastDescriptorHandleToResource` switch, and concluded buffer handles still hit it. In fact that arm is a **residual internal-invariant fallback**, reachable only by a result type that is neither texture nor sampler. Buffer handles never get there — they route earlier via `kIROp_SPIRVLoadDescriptorFromHeap` (:5091) → `emitDescriptorHeapLoad` (:5105), which the PR's own tests assert.

**The rule:** the presence of an abort/throw/diagnostic in a switch or if-chain tells you *nothing* about whether your input reaches it. Before asserting "input X still hits abort Y," read the **dispatch routing** — which arm claims X, and does an earlier branch intercept it? A string grep finds the sink; only the routing tells you the path.

**Cost of getting it backwards:** we recommended parking authorized work on a false premise, and put the false claim in a public GitHub comment that then needed a correction. The maintainer had to spend a round-trip fixing our reading of his own PR.

**Generalization:** this is the same shape as "a green job with a skipped backend = zero coverage" — a signal that *looks* load-bearing (abort exists / job passed) but is disconnected from the question asked (does my input reach it / did my code run). When a premise is load-bearing for a park-or-ship decision, verify the path, not the landmark.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785775132104-an-abort-in-a-switch-says-nothing-until-you-read-t.md`_
