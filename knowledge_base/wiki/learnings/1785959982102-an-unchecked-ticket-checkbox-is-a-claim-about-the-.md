---
title: "An unchecked ticket checkbox is a claim about the checkbox, not the code"
type: learning
topic: verification
source: learnings/1785959982102-an-unchecked-ticket-checkbox-is-a-claim-about-the-.md
---

# An unchecked ticket checkbox is a claim about the checkbox, not the code

Scrubbing `shader-slang/slangpy#768` (4 checklist items, **all boxes unchecked**) against `main`: not one of the four states matched what the empty boxes implied. Generalizable scrub method:

1. **Check each box against source, independently.** Item 1 was fully implemented — it landed in PR #818 *a month after the issue was filed*, so nobody went back to tick it. An unchecked box often just means "no one revisited the ticket."
2. **Check *which path* the capability lives in, not just whether it exists.** Items 2–3 existed — but in `dispatchdata.py`, the very `.dispatch()` path the issue says "should be retired," while the issue's actual ask was to port them into `calldata.py`. Those files *predated* the issue, so they were never new work. "The feature exists" and "the requested work is done" are different questions, and conflating them produces a false close.
3. **Separate capability from specified mechanism.** Item 4's capability works end-to-end (a backward pass over a hand-authored `[CUDAKernel] [Differentiable]` fn passes on CUDA), but the specified mechanism — *inferring* `[CUDAKernel]` on a generated backward from the forward — is absent: the token appears **0 times in implementation code** (all 29 hits are test/benchmark `.slang` + comments). Grep implementation vs. tests separately; a passing test can mask an unimplemented feature the user is hand-supplying.
4. **Date the features with `git log -S` — after confirming the clone isn't shallow** (`git rev-parse --is-shallow-repository`). A graft makes `-S` return silence that reads as a confident negative.
5. **A deprecated path that grew a test suite is a contradiction to escalate, not resolve.** `.dispatch()` is described as "not well maintained" yet now has 16 passing tests across CUDA/Vulkan/Metal. Retire-vs-keep is a maintainer decision; state it as the blocker rather than picking.

Also: **verify handed leads before repeating them.** I was told `test_override_threadgroup` passing was evidence for item 1 ("thread count at dimensionality 0"). It isn't — it exercises `thread_group_size`, the `[numthreads]` *block* dims, in a different code path; item 1 is the *grid* thread count. A plausible lead that matches your expectation is the one you'll forget to check.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785959982102-an-unchecked-ticket-checkbox-is-a-claim-about-the-.md`_
