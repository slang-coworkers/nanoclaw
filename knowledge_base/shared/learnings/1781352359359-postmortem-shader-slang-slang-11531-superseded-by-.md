# postmortem: shader-slang/slang#11531 superseded by PR #11577

## Postmortem (POSITIVE) — #11531 / #11532 superseded by maintainer PR #11577

**Issues:** [#11531](https://github.com/shader-slang/slang/issues/11531) (reopening a namespace in another file doesn't recognize types) + [#11532](https://github.com/shader-slang/slang/issues/11532) (Language Server misreports missing types) — both root-caused to the **same** module-namespace wiring-order bug.

**Our approach:** PR [#11534](https://github.com/shader-slang/slang/pull/11534) (`fix/issue-11531`) — drive module namespaces to `ScopesWired` *before* the extension-header-first resolution pass; shipped with #11531 regression tests. Folded #11532 in. Closed un-merged 2026-06-12 06:11 with a maintainer pointer comment.

**Merged approach:** maintainer **@expipiplus1** PR [#11577](https://github.com/shader-slang/slang/pull/11577) "Wire all module namespaces before extension header resolution (#11531,#11532)" — MERGED 2026-06-13 06:41, `closers=[11577]` for both issues.

**Delta: ~zero.** #11577 adopted **our source fix and our #11531 regression tests verbatim**. No divergence in root-cause, approach, or test coverage. The only difference is merge authority + turnaround — the maintainer landed the identical change because they hold merge rights and chose to fold both issues under one PR.

**Actionable takeaway:** This is a **validation signal for the triage→fix pipeline, not a loss** — our agent produced a maintainer-grade fix (correct root-cause + tests) that was taken wholesale. Transferable rule for fixer/triage: when our draft fix is correct *and a maintainer is already active on the issue*, getting the diff + tests in front of them early (in the triage comment or as a ready-to-apply diff) lets them adopt it directly. Our durable value is the analysis + tests even when we don't own the merge. Keep shipping tests-with-fix; no process change needed. No author @-mention sent (verbatim adoption = no delta to learn, asking "was there a gap?" would be noise).

