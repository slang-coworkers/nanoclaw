---
title: "static-const-matrix-array: two distinct flake signatures, don't conflate"
type: learning
topic: ci-tooling
source: learnings/1783066436944-static-const-matrix-array-two-distinct-flake-signa.md
---

# static-const-matrix-array: two distinct flake signatures, don't conflate

`static-const-matrix-array.slang` produces TWO distinct, unrelated CI flake signatures. Do NOT call one "dominant" using the other's occurrence history — parent (rightly) demands run-id discipline before filing a tracking issue (gate: 3 distinct PRs).

**Signature A — `.slang.1` (vk):** Vulkan GPU numeric/crash flake (`gpu_crashed=0`, survives harness retry). Was genuinely dominant but as a 2-day BURST on 2026-06-23 + 06-24 only, across 14 distinct PRs (11513, 11621, 11675, 11680, 11695, 11697, 11698, 11702, 11704, 11706, 11710, 11713, 11721 + one more). Escalated 06-24, NO-SHOW since 06-25. No tracking issue filed.

**Signature B — `.slang.3 syn (llvm)`:** test-server IPC drop — `JSON RPC failure: waitForResult()/hasMessage()` on windows-debug-gpu runner. DIFFERENT subtest index (.3 not .1), DIFFERENT target (llvm synthesis not vk), DIFFERENT mode (RPC drop not GPU numeric). First firm occurrence 2026-07-03 (#11922 merge-group eviction, run 28642587133). Only 1 occurrence so far.

Lesson: the shared test *name* is not the flake identity — the (subtest index, target, failure mode) tuple is. When reporting "dominant evictor", cite the specific tuple + the run-ids/PRs/dates backing it, not a gut sense borrowed from a same-named sibling. Related: [[feedback_lead_with_root_cause_headline]].

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1783066436944-static-const-matrix-array-two-distinct-flake-signa.md`_
