---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788399237981-np1lto
written_at: 2026-09-09T09:46:42.230Z
---

# [approver/challenger-miss] Uninit-analysis guard-correlation PRs: probe path-blocking predicates for vacuous-truth

## Symptom
shader-slang/slang#12894 (fix for #12545, E41035 false positive on WaveIsFirstLane-guarded stores read via WaveReadLaneFirst) merged 2026-09-09 at commit `d3040fc04f8d` — the exact commit the approver last decided on — with an independent maintainer approval (expipiplus1, `reviewDecision=APPROVED`). The approver had ABSTAIN_POLICY'd both revisions on `CLAUSE_FAIL:head_provenance` (fork head, bundled v0-shadow), so it never reached the challenger and never reviewed the code.

## Root cause / what the challenger would have wanted
Between the first revision (`cd23a4880889`) and the merged head (`d3040fc04f8d`) the AUTHOR added a self-caught fix commit titled **"Fix vacuous-true soundness gap in isEveryPathFromBlockedByStore"**. That is exactly the false-safe shape flagged for this issue in Step-0 recall: a new path-blocking / guard-correlation predicate in the uninitialized-values pass (`slang-ir-use-uninitialized-values.cpp`) that is **vacuously true** silences real must-init warnings — the WaveIsFirstLane↔WaveReadLaneFirst fix must key on the *specific* guard↔read correlation; a predicate that always returns "blocked/covered" would suppress genuinely-uninitialized cases (e.g. store guarded by `if(!WaveIsFirstLane())`).

## How to catch it (transferable probe)
For any PR that ADDS a guard/coverage/path-blocking predicate to must-init / uninitialized / uniformity analysis (functions like `isEveryPathFromBlockedByStore`, `cancelLoadsByDefiniteAssignment`): the challenger must check the new predicate is **not vacuously true** — that there exists an input on the supported path for which it returns false and the diagnostic still fires. The safety artifacts (CI-green, byte-identical codegen) cannot see a missing diagnostic, so demand a **trigger-present negative control**: a test where the guard/read correlation is absent and E41035 must still warn. The author self-found this here; a challenger reviewing this shape should have probed it first.

## Fix / calibration note
Merge outcome recorded: fork-head `head_provenance` abstains from trusted MEMBER authors are being independently maintainer-approved and merged unchanged (this PR; cf. #12741). These abstains carry zero substantive signal — they preempt review entirely. This is accumulating cost evidence for the standing empty-policy-mount escalation (see memory `operations/approver-policy-mount.md`): restoring `allow_fork_head` for trusted authors would let the challenger actually run on PRs like this instead of blanket-abstaining.
