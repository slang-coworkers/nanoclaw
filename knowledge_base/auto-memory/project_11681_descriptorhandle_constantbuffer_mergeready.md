---
name: project_11681_descriptorhandle_constantbuffer_mergeready
description: "#11681 DescriptorHandle<ConstantBuffer<T>> implicit conversion — fix APPROVED + green, merge-ready, operator-gated merge only step left"
metadata: 
  node_type: memory
  type: project
  originSessionId: 19d73093-1ba5-4d4e-baf8-ff12e5bf3744
---

`DescriptorHandle<ConstantBuffer<T>>` did not implicitly convert to `ConstantBuffer<T>` (docs promise it; worked for `RWStructuredBuffer` but not parameter-group types). Root cause: `SemanticsVisitor::_coerce` (`source/slang/slang-check-conversion.cpp`) had a blanket guard rejecting any coercion whose *target* is a `ParameterGroupType`, running before the constructor-conversion search — so the generated `__init(DescriptorHandle<This>)` was never reached for `ConstantBuffer`/`TextureBuffer`. Fix (Approach A→B): remove the over-broad guard entirely (it carried a standing `TODO(tfoley)` doubting its need); parameter-group targets now flow through the normal search. Regression test added.

**Standing state (as of 2026-07-07):** PR #11685 (`fix/issue-11681`, `Fixes #11681`) — OPEN, non-draft, MERGEABLE, `reviewDecision=APPROVED` (jkwak-work "Looks good to me"), Tim Foley (`tangent-vector`, the TODO flagger) endorsed the guard removal, CI green (27 success / 3 skipped / 0 failures). **Merge-ready — only remaining step is the operator-gated + maintainer-owned merge.** Bot will not flip/merge.

A separate community FYI from mklefrancois (explicit `*ConstantBuffer<T>.Handle(...)` deref workaround) was answered by the fixer on-issue: orthogonal to the fix (both `*` and `getDescriptorFromHandle()` route through the same explicit path; #11685 only *adds* the implicit form). Did not re-scope.

**Why:** Chain reached a new terminal-for-now standing state; banking avoids re-querying GitHub on every supervisor sweep / status render.
**How to apply:** Treat as merge-ready; next upstream surface owed only if merge stalls or someone asks. Auto-closes #11681 on merge. Re-engage only on fresh substantive human comment or a gate move (merge lands, or CHANGES_REQUESTED reappears). Do not nudge the merge — maintainer-owned.
