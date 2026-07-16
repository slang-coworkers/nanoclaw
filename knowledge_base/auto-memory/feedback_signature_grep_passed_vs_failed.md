---
name: feedback_signature_grep_passed_vs_failed
description: "A CI flake-signature attribution from grepping a test NAME can catch a 'passed test:' line, not 'FAILED test:' — verify the matched line's pass/fail before treating a test as the failure, especially before escalating"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

Grepping a CI log for a **test name** to attribute a failure is unsafe: the same name appears on both `passed test:` and `FAILED test:` lines. Matching the name alone can pin a failure on a test that actually **passed** — and if that misattribution feeds an escalation, you hand a maintainer a false receipt.

**Observed 07-15 (#11951 fix-gap false alarm):** slang-ci-babysitter fingerprinted run 29376935541 as dropping on `static-const-matrix-array.slang.3 syn (llvm)` — it had grepped the test name and caught the `passed test:` line. On attempt-granular re-pull, that test **passed on all 3 attempts**; the real FAILED set was an allocator `.internal` batch (a separate PR-caused mimalloc fault on #12105). The misread became the sole surviving receipt for a "#11951 AVX-512 fix-gap" I escalated to jkwak on his just-closed issue — a false alarm I then had to retract via edit-in-place.

**How to apply:**
- **When a coworker attributes a CI failure to a specific test, the load-bearing check is: was that test on a `FAILED` line, not merely present in the log?** Ask for (or confirm) the FAILED-set enumeration, not a name-grep hit — especially before I relay it to a maintainer or use it as escalation evidence. Relates to [[feedback_verify_regression_claims_at_precision]] (verify at claim-precision) and [[feedback_never_relay_a_verdict_not_in_hand]].
- **Escalations built on a single receipt are fragile** — when one witness cleared (#12064 flake) and the other was confounded (#12105 = allocator PR whose failed batch mapped 1:1 to its own changed files), the whole flag collapsed. Before escalating a "fix-gap / regression despite fix," demand ≥1 receipt that is BOTH post-fix-active AND on a test unrelated to the PR's own change. A failed batch that overlaps the PR's changed files is PR-caused until proven otherwise.
- **Retracting an over-claim is cheaper than making one** — green-light a conservative retraction fast (it returns the issue to its prior maintainer-decided state; downstream discriminators re-catch a genuine signal). Do NOT let sunk-cost keep a wrong claim live on a maintainer's issue.
- **Edit-in-place on retraction** (bot was last commenter) per [[feedback_github_comment_hygiene]]; keep the confounded issue (#12105 mimalloc) and the closed issue (#11951 AVX-512) cleanly separated.
