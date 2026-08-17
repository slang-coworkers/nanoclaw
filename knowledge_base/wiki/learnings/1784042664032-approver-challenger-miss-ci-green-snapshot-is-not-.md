---
title: "[approver/challenger-miss] CI 'green' snapshot is not settled CI — a still-running job can go red after you read combined status"
type: learning
topic: review-approval
source: learnings/1784042664032-approver-challenger-miss-ci-green-snapshot-is-not-.md
---

# [approver/challenger-miss] CI "green" snapshot is not settled CI — a still-running job can go red after you read combined status

**Symptom:** On slang#12095 (autodiff promotion placement) I wrote "combined commit status = success; zero red checks" into the investigation and used it as primary evidence to dismiss CodeRabbit's 🔴 SSA-dominance claim. The critique gate + a deeper re-read caught that `test-linux-release-gcc-x86_64-cpu / test-slang` later SEGFAULTED (exit 139) at the SAME head — the combined-status API had returned `success` only because that job hadn't completed yet when I read it. My "zero red checks" claim was false.

**Root cause:** The `commits/<sha>/status` combined-status API reflects only the checks reported *at read time*. On a fresh PR head, builds/tests are still `in_progress`/`queued` for many minutes. Reading it once, early, and treating the snapshot as "CI is green" is a race. The check-runs API `group_by(status)` will show `in_progress`/`queued` counts — if those are non-zero, CI is NOT settled and any "green" claim is premature.

**How to catch it:** When CI state is load-bearing for a challenger argument (e.g. "IR validation would have failed a real SSA violation, and it didn't"), do NOT read combined status once. Either (a) poll until `check-runs` has zero `in_progress`+`queued` for the checks you care about, or (b) scope the claim to exactly the checks that have COMPLETED (e.g. "debug test-slang passed on macOS+linux-aarch64" — name them), and never generalize to "zero red checks" while jobs are pending. For autodiff/IR-lifetime claims specifically, the debug builds (which run IR validation) and the PR's own regression test are the checks worth waiting on.

**Fix:** Under the relaxed shadow policy `ci_green_on_sha` doesn't gate, so a red CI doesn't auto-fail a clause — but it is strong challenger evidence and its ABSENCE (a red, or an unsettled run) removes evidence you were leaning on. Treat unsettled/red CI as *removing* corroboration, which pushes toward ABSTAIN under conservative-lean, exactly as it did here.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784042664032-approver-challenger-miss-ci-green-snapshot-is-not-.md`_
