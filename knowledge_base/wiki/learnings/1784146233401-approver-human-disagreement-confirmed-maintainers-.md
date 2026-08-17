---
title: "[approver/human-disagreement] CONFIRMED: maintainers self-merge THROUGH a mechanically-red required aggregate gate when the only red is confirmed infra-flake — a red check-ci is not a merge blocker if it's aarch64-only apt/network"
type: learning
topic: review-approval
source: learnings/1784146233401-approver-human-disagreement-confirmed-maintainers-.md
---

# [approver/human-disagreement] CONFIRMED: maintainers self-merge THROUGH a mechanically-red required aggregate gate when the only red is confirmed infra-flake — a red check-ci is not a merge blocker if it's aarch64-only apt/network

**Symptom / calibration signal:** shader-slang/slang#12123 (test-only split, jkwak-work) was decided WOULD_APPROVE @752ce2fa even though the required `check-ci` aggregate gate was still mechanically RED (rolling up two `build-linux-*-gcc-aarch64` apt/`ports.ubuntu.com` infra-flake builds). The PR then **MERGED unchanged at that exact commit** (mergeCommit 20148df5, self-merged by jkwak-work), verified vs live GitHub — with the aarch64 builds NEVER re-run before merge. Human verdict = APPROVED = clean agreement.

**What this confirms (the transferable lesson):**
1. **A red required aggregate gate (`check-ci`) is NOT a merge blocker when its only inputs are confirmed infra-flake.** Maintainers on shader-slang/slang will admin-merge straight through a red `check-ci` when they can see the failing legs are aarch64 apt/network Setup-stage flakes, not code. So WOULD_APPROVE was the right call, not ABSTAIN — the "mechanically red gate" is not the maintainer's bar; the CODE being clean is.
2. **The ABSTAIN→WOULD_APPROVE upgrade on settled CI was correct.** My first ABSTAIN was gated on "8 checks in-flight, cannot complete." Once those settled green and the only residual red was the SAME aarch64 infra-flake (identical job IDs = re-report, not re-run), upgrading was right — the human merged on exactly that state.
3. **Don't over-weight a red required gate for a clean test-only change.** Prior calibration (#12009/#12089) says "don't round up a red required check on head" — but those were FUNCTIONAL reds / genuinely-in-flight code checks. This case sharpens the rule: **the anti-round-up applies to code-revealing reds and unsettled code checks, NOT to an aggregate gate whose sole red inputs are proven-infra flakes.** Distinguish "gate is red" from "a code check failed."

**How to apply next time:** When the only thing standing between a clean PR and green is a required aggregate gate rolling up confirmed-infra flakes (aarch64 apt/network, cross-PR-proven), that is WOULD_APPROVE, not ABSTAIN — document the mechanically-red gate as a non-blocking infra re-run in the decision, but don't let it hold the verdict. Still verify the merge SHA vs live GitHub on the join (repeated lesson).

Related: [approver/clause-gap] new-check_suite-is-reclassification-not-new-revision; [approver/challenger-miss] aarch64 Setup-stage apt/ports.ubuntu.com infra-flake; #12089 combined-status-vs-check-runs.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784146233401-approver-human-disagreement-confirmed-maintainers-.md`_
