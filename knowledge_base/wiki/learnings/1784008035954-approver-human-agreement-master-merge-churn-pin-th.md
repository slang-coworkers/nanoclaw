---
title: "[approver/human-agreement] master-merge churn: pin the PR-diff hash, re-verify structural claims when the base moves, treat pipeline-incompleteness as an explicit judgment"
type: learning
topic: review-approval
source: learnings/1784008035954-approver-human-agreement-master-merge-churn-pin-th.md
---

# [approver/human-agreement] master-merge churn: pin the PR-diff hash, re-verify structural claims when the base moves, treat pipeline-incompleteness as an explicit judgment

**Symptom:** A live PR (#12052, a 33-line front-end conformance fix) synchronized 3× *during* the review — first a real test-only commit, then two `Merge branch 'master'` commits days apart. Each master-merge moved the head, pre-empting the reviewer's full correctness pipeline before it converged, so the review never "completed" the normal way. Risk: either reflexively re-target on every push (never finalize) or rubber-stamp against a stale pin.

**Root cause / what actually mattered:** For a branch that only ever gets master merged in, the PR's *own contribution* is unchanged even though the head SHA and the whole tree move. `gh pr diff` computes the diff vs the merge base, so `sha256(gh pr diff <pr>)` is a stable identity for "the PR's content" across master-merges. Here it stayed byte-identical (`ef2f5cf7…`) across all 4 commits — that's the signal that a re-review is about the *base*, not the *change*.

**How to catch it / the discipline that worked:**
1. **Debounce, don't re-target reflexively.** On repeated synchronize, first compare `sha256(gh pr diff)` to the prior value. Identical ⇒ master-merge, not a fix change. Wait for a quiet head (≥15 min no push) before finalizing; arm a head-stability monitor rather than polling.
2. **A master-merge is NOT a structural no-op for the approver.** Use the GitHub compare API (`gh api repos/OWNER/REPO/compare/A...B --jq '.files[].filename'`), NOT a local clone, to see what the merge pulled in. A stale/absent local clone makes `git diff` fail *silently* and report "nothing changed" — a false negative that nearly let me carry forward structural claims that the merge had actually touched (`slang-check-decl.cpp` +897/-676 including the exact `getCandidateExtensionsForTypeDecl` function the fix depends on). Re-verify any structural claim whose backing file the merge touched. (Here the refactor added a cache only in the `!m_module` branch; the fix's `m_module`→`importedModulesList` path was untouched → HOLDS. But that was verified, not assumed.)
3. **When a test drops `-skip-spirv-validation`, SPIR-V validation becomes a load-bearing runtime axis** — and a master-merge touching the emitter/IR passes can regress it independently of the front-end fix. Close it empirically (local build + `SLANG_RUN_SPIRV_VALIDATION=1`, and/or CI `test-slang` jobs which run the validating test), not by reasoning.
4. **A pre-empted full reviewer pipeline is an explicit judgment call, not an auto-abstain.** The literal harness-integrity trip (reviewers_complete false / doc<500B / diff_hash≠sha) may not fire even when the open-ended bug-hunt didn't run. Decide sufficiency on the change's *blast radius*: here the fix seeds one list with exactly 2 enumerable consumers (both adjudicated), the open-ended-finder role was filled by Devin, and the one runtime risk was exercised. Get the reviewer's *explicit* sufficiency call (don't infer it) and record it; back it with your own independent structural verification. Scope the "sufficient" claim to this size/shape — it does NOT generalize to IR/emitter/ABI-touching changes.

**Fix / outcome:** WOULD_APPROVE (CLEAN) at the quiet head; human independently APPROVED the same content — agreement confirmed. The transferable rule: `gh pr diff` hash is the PR's identity across base churn; re-verify (via compare API, never a maybe-stale clone) the specific structural claims whose files the base moved; and treat reviewer-pipeline incompleteness as a blast-radius-scoped judgment you record, not a reflex. See [[slang-11531-root-cause-extension-headers-resolve-n]] for the primary-file/extension-visibility class this fix belongs to.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784008035954-approver-human-agreement-master-merge-churn-pin-th.md`_
