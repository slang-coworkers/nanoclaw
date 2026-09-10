---
name: project_11681_descriptorhandle_constantbuffer_mergeready
description: "#11681 DescriptorHandle<ConstantBuffer<T>> implicit conversion — fix APPROVED + green, merge-ready, operator-gated merge only step left"
metadata: 
  node_type: memory
  type: project
  originSessionId: 19d73093-1ba5-4d4e-baf8-ff12e5bf3744
---


**✅ TERMINAL — GATE DISCHARGED 2026-07-09 (Main-verified against GitHub 2026-08-03, not against either of my own texts).**
`#11685` **MERGED** `2026-07-09T14:25:20Z`; issue **#11681 CLOSED** `2026-07-09T14:25:21Z`, `state_reason: completed`.
⇒ the standing condition *"resolved only once #11685 merges"* is **satisfied**; this memory sat **~26 days past its own
stated expiry** while still reading as live. ⛔ No action pending. History below retained for provenance only.

⚠️ **Found by an expired-gate sweep, not by reading this file** — a self-expiring note does not expire itself. Grep your
store for `expires when|once X merges|delete this memory` and resolve each trigger against **ground truth**
([[feedback_correction_must_sweep_whole_file]]).

---

`DescriptorHandle<ConstantBuffer<T>>` did not implicitly convert to `ConstantBuffer<T>` (docs promise it; worked for `RWStructuredBuffer` but not parameter-group types). Root cause: `SemanticsVisitor::_coerce` (`source/slang/slang-check-conversion.cpp`) had a blanket guard rejecting any coercion whose *target* is a `ParameterGroupType`, running before the constructor-conversion search — so the generated `__init(DescriptorHandle<This>)` was never reached for `ConstantBuffer`/`TextureBuffer`. Fix (Approach A→B): remove the over-broad guard entirely (it carried a standing `TODO(tfoley)` doubting its need); parameter-group targets now flow through the normal search. Regression test added.

**Standing state (as of 2026-07-09, MERGE-READY):** PR #11685 (`fix/issue-11681`, `Fixes #11681`) — OPEN, non-draft, MERGEABLE, `reviewDecision=APPROVED`. Tim Foley (`tangent-vector`, the TODO flagger) endorsed the guard removal; jkwak-work re-approved after the churn below (re-approval `4659424154` on current head `9bce564`, verified not-stale). **Merge-ready — only remaining step is the operator/maintainer-owned merge; bot will not flip/merge.** CI at last check: 17 pass / 3 skip / 0 fail / 11 pending (not yet fully green, no failures).

**Resolved churn (2026-07-09, self-healed):** a transient RED (5 `test-slang` jobs, #11647/`StorageBuffer` diagnosis) prompted a test-only fix push (`9bce564`, slang-test 1/1). That push dismissed jkwak's approval via the repo's dismiss-stale-approvals branch protection (APPROVED→REVIEW_REQUIRED, same trap as #11999). jkwak then re-approved on the new head → back to APPROVED. The fixer's mid-excursion "gate unchanged / still approved" claim was stale and the triager corrected it. Excursion returned to the same merge-ready state — not re-reported upstream (round-trip to last-reported state).

**Re-triage (2026-07-08):** jkwak asked "resolved with ToT? check repro." Triager verified #11685 still OPEN/unmerged + guard byte-present in ToT `slang-check-conversion.cpp:2188-2195` + empirically reproduced E30019 on slangc `2026.12.2-60-g33f9ed0ce`. Verdict posted on-issue (comment `4915699000`): **still reproduces on ToT; resolved only once #11685 merges** — not "no-repro just because a fix exists."

A separate community FYI from mklefrancois (explicit `*ConstantBuffer<T>.Handle(...)` deref workaround) was answered by the fixer on-issue: orthogonal to the fix (both `*` and `getDescriptorFromHandle()` route through the same explicit path; #11685 only *adds* the implicit form). Did not re-scope.

**Why:** Chain reached a new terminal-for-now standing state; banking avoids re-querying GitHub on every supervisor sweep / status render.
**How to apply:** Treat as merge-ready; next upstream surface owed only if merge stalls or someone asks. Auto-closes #11681 on merge. Re-engage only on fresh substantive human comment or a gate move (merge lands, or CHANGES_REQUESTED reappears). Do not nudge the merge — maintainer-owned.
