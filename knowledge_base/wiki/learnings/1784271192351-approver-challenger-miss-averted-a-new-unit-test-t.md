---
title: "[approver/challenger-miss-averted] A new unit test touching the polymorphic internal Slang::Session (via asInternal()) fails to link ONLY in the sanitizer job — -fno-rtti + -Wl,--no-undefined turns a lazy-undefined typeinfo into a hard build break"
type: learning
topic: review-approval
source: learnings/1784271192351-approver-challenger-miss-averted-a-new-unit-test-t.md
---

# [approver/challenger-miss-averted] A new unit test touching the polymorphic internal Slang::Session (via asInternal()) fails to link ONLY in the sanitizer job — -fno-rtti + -Wl,--no-undefined turns a lazy-undefined typeinfo into a hard build break

**Symptom:** slang#12136 fix-push @ 04d90845 added `tools/slang-unit-test/unit-test-lazy-autodiff-module.cpp`. All 10 test-slang jobs passed, but `sanitizer-linux-clang-x86_64 / sanitizer` was RED with `unit-test-lazy-autodiff-module.cpp.o: undefined reference to typeinfo for Slang::Session` (x4). `check-ci` (aggregator) also red.

**Root cause:** The test calls `asInternal(globalSession.get())` — `asInternal(slang::IGlobalSession*)` (slang-compiler-api.h:34) returns `ComPtr<Slang::Session>`, the polymorphic internal class. Touching that type (e.g. `->coreModules`) makes the compiler want `typeinfo for Slang::Session`. Slang builds `-fno-rtti` (codebase invariant), so that typeinfo is never emitted → an undefined symbol. Normal builds link it lazily (unresolved-but-unused-at-runtime is tolerated), so test-slang passed. The sanitizer build adds `-Wl,--no-undefined`, which turns ANY unresolved symbol into a HARD link failure at `libslang-unit-test-tool.so`. So the SAME latent undefined-typeinfo becomes a build break only under the sanitizer's stricter link.

**Why it's easy to miss / mis-triage:** (a) Only ONE of ~12 CI lanes (the sanitizer) goes red — a per-lane check-runs scan is essential; a combined-status glance or "test-slang all green" misses it. (b) The failing log leads with `ld: DWARF error: invalid or unhandled FORM value: 0x23`, which is warning-class NOISE (old binutils ld vs clang-18 DWARF5). Per the prior shared learning (1784182764154), do NOT classify off the DWARF line — grep the SAME log for `undefined reference|typeinfo|vtable for|multiple definition` to find the REAL error. I did, and the typeinfo line was the real cause. (c) Neither the primary review nor Devin flagged it — reviewers don't run the sanitizer link; challenger-caught (class of #12130/#12122 where ci_green_on_sha is blind under require_ci_green=false).

**Transferable challenger check for any PR adding/altering a unit test that reaches compiler internals:** does the test reference a polymorphic internal Slang type (Session, Linkage, Module, etc., typically via `asInternal()`)? Under -fno-rtti that risks `undefined reference to typeinfo for <T>` which the sanitizer's `-Wl,--no-undefined` will surface as a hard build break even when all other lanes pass. Confirm PR-causality: is the failing object the PR's new/changed file? was the lane green at the prior head? are other current PRs' sanitizer jobs green? (all yes here → PR-caused, not infra).

**Fix (author-owned next-action):** the unit test must not depend on RTTI/typeinfo for the internal type — access the needed state via a non-polymorphic path (e.g. a plain pointer/accessor that doesn't instantiate typeinfo), or exclude the test from the `-Wl,--no-undefined` sanitizer build. Then re-run sanitizer to green.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784271192351-approver-challenger-miss-averted-a-new-unit-test-t.md`_
