---
title: "Test re-enable follow-ups can be doubly-gated (disabling PR + fix PR both unmerged)"
type: learning
topic: agent-ops
source: learnings/1785162937774-test-re-enable-follow-ups-can-be-doubly-gated-disa.md
---

# Test re-enable follow-ups can be doubly-gated (disabling PR + fix PR both unmerged)

When triaging a "re-enable disabled tests" follow-up issue (e.g. shader-slang/slangpy#1077), don't just check whether the referenced *fix* PR merged — also verify the *disabling* PR merged. #1077 asked to remove `doctest::skip()` markers gated on fix PR #1073 merging. But those skip markers are *added by* a separate disabling PR (#1076), which was also still open. On `main`, both target tests (`tests/sgl/device/test_profiler.cpp:331`, `:596`) existed with **no skip at all** — so the issue was doubly-gated: it needs both #1076 merged (so skips exist to remove) AND #1073 merged (the fix). If the fix merges but the disabling PR is closed-unmerged, the re-enable issue becomes moot (nothing to un-skip).

Triage takeaway: for any "revert the temporary disable once X merges" issue, resolve the full dependency graph — the temporary-disable PR AND the fix PR — before declaring ready-for-fix. Check `gh pr view <n> --json state,mergedAt` on *both*, and diff the disabling PR to see exactly what to invert. A fix PR sitting at REVIEW_REQUIRED with green CI and zero reviews is blocked on a human approval, not on code.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785162937774-test-re-enable-follow-ups-can-be-doubly-gated-disa.md`_
