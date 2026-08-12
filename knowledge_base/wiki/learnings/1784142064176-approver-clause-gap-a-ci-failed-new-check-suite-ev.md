---
title: "[approver/clause-gap] A '[CI failed — new check_suite]' event at an already-decided head is a re-classification trigger, not a new revision — check job IDs to tell same-run re-report from a real new red"
type: learning
topic: review-approval
source: learnings/1784142064176-approver-clause-gap-a-ci-failed-new-check-suite-ev.md
---

# [approver/clause-gap] A "[CI failed — new check_suite]" event at an already-decided head is a re-classification trigger, not a new revision — check job IDs to tell same-run re-report from a real new red

**Symptom:** After deciding ABSTAIN_POLICY on shader-slang/slang#12123 @752ce2fa (gated explicitly on "CI unsettled — 8 checks in-flight"), a second `[CI failed — new check_suite]` event fired at the SAME head `752ce2fa` (new suite 79690722760, distinct suite ID from the earlier 79688768084). The orchestrator asked: re-report of the known infra-flake (verdict holds/upgrades) or a NEW real red (→ BLOCK)?

**Root cause of the confusion:** a "new check_suite" event does NOT mean the failing jobs re-ran. GitHub emits a fresh check_suite record as the suite's other jobs complete; the same failing job runs get re-surfaced under it. Reading "new check-suite failure" as "a new failure" would wrongly flip a clean PR toward BLOCK.

**How to catch it — the decisive discriminators:**
1. **Head unchanged ⇒ NOT a new revision.** If `gh pr view --json headRefOid` still equals the head you decided on (no new commits, no new human review), this is a CI-classification UPDATE to your existing decision, not a fresh harvest+Devin+decision cycle. Diff and harvested review are unchanged; don't re-review.
2. **Compare failing-job IDs across the two suites.** `gh api repos/<r>/check-suites/<id>/check-runs --jq '.check_runs[]|select(.conclusion=="failure")|{name,id}'`. If the failing jobs carry the SAME job IDs as the ones you already classified (here 87424372349/87424372393), they are the *same runs* — a re-report, not a re-run. A genuine new red has new job IDs.
3. **Enumerate what turned GREEN.** The point of the event is that previously-in-flight checks settled. If every previously-pending check that could reveal a code problem is now green (esp. the full `test-slang`/`test-slang-rhi` suite that runs the changed code), no new real red emerged.
4. **Classify aggregate gates separately.** A red `check-ci` ("Check CI Results") is a `needs:`-style roll-up — read its log; if it only names the known-failed jobs (+ their downstream `skipped` tests) with no independent error, it is not a new failure.

**Fix / rule:** If the only residual reds are the same infra-flake (same job IDs) + their aggregate, and all previously-in-flight code-revealing checks went green, then: (a) the BLOCK branch does not fire (no new real red); (b) the original ABSTAIN's "cannot complete an in-flight check" blocker is now RESOLVED → the challenger's WOULD_APPROVE standard ("complete + clean investigation") is met → **upgrade ABSTAIN → WOULD_APPROVE** (one ledger row per (repo,pr,commit); the re-classification supersedes). Run a fresh DECISION_REVIEW + OUTPUT_REVIEW critique for the new verdict. Caveat to document (non-blocking): a required aggregate gate can stay mechanically red until the infra-flaked jobs are re-run — that's a re-run, not a code concern, and a shadow WOULD_APPROVE measures the approval judgment on the change, not merge-button clickability.

Related: [approver/challenger-miss] aarch64 Setup-stage apt/ports.ubuntu.com infra-flake; and #12089 — combined-status API only sees 3 legacy contexts, classify from check-runs.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784142064176-approver-clause-gap-a-ci-failed-new-check-suite-ev.md`_
