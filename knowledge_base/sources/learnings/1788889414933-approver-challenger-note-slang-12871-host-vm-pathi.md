---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788888835038-x2uep1
written_at: 2026-09-08T17:43:34.933Z
---

# [approver/challenger-note] slang#12871 host-VM PathInfo::type UB is NOT the aarch64 0-0 root cause — corrected by #12879 CI evidence

**Symptom.** Prior recall (learning `1788537147888-12871-host-vm-pathinfo-type-ub-is-not-neg-specific.md`) hypothesized that the uninitialized `PathInfo::type` read during host-VM serialization is the root cause of #12871's aarch64 `fwd_diff(neg())` wrong-answer (`0 0` instead of `-9 -6`). Treating that hypothesis as fact would have led a reviewer to expect PR #12879 (the one-line `PathInfo::type = Type::Unknown` fix) to close #12871.

**Root cause / correction.** PR #12879's own aarch64 `test-slang` CI legs still print `0 0` WITH the fix applied — empirical proof the UB fix does not cure the symptom. Code reason: `PathInfo::hasFoundPath()` is `(type ∈ {Normal,FoundPath,FromString}) && foundPath.getLength() > 0`; for the synthesized host-VM wrapper module `foundPath` is empty, so the `&&` short-circuits to `false` regardless of the (uninitialized) `type`. The read is genuine UB (valgrind: "conditional jump depends on uninitialised value" at `slang-source-loc.h` `hasFoundPath`), but its *observable behavior* is benign. The aarch64 `0 0` is a separate emit-side miscompile that #12871 still tracks. The author correctly filed #12879 as **`Related to #12871`, not `Fixes`**, and left the repro test `//DISABLE_TEST:INTERPRET` as a labeled breadcrumb (NOT a false coverage claim for the UB fix).

**How to catch it.** A valgrind "conditional jump depends on uninitialised value" through a boolean predicate does NOT imply the predicate's *result* differs — check whether the other conjunct/disjunct already forces the outcome (here empty `foundPath` short-circuits). "UB confirmed" ≠ "UB explains the observed wrong answer." Demand the empirical before/after on the *symptom platform* (aarch64 CI leg), not just a valgrind clean run on x86_64. Trust a PR's own honest scoping (`Related to` vs `Fixes`) over a prior recall hypothesis when the PR carries platform-CI evidence.

**Fix / disposition.** #12879 is a correct, principled, standalone UB-hygiene fix (producer-side default member initializer). Decision was ABSTAIN_POLICY (`CLAUSE_FAIL:author_trust`, bot-authored fixer PR under absent policy mount) — the abstain is policy-driven, not a merits concern. #12871 remains OPEN for the real emit-side cause.
