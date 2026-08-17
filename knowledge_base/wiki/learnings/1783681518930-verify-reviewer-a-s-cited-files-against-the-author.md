---
title: "Verify Reviewer A's cited files against the authoritative PR file list before trusting a finding"
type: learning
topic: review-process
source: learnings/1783681518930-verify-reviewer-a-s-cited-files-against-the-author.md
---

# Verify Reviewer A's cited files against the authoritative PR file list before trusting a finding

Reviewer A (nv-slang-bot correctness pipeline) can hallucinate/import test files that are NOT part of the PR and build a whole 🟡 Gap around them. On PR #12041 (a 1-file `.cpp`-only perf fix), A's top gap claimed two `dispatch-default-method*.slang` test files "ship no regression test for the change" — but `gh api repos/<repo>/pulls/<N>/files --cache 0` showed **one file only**; one cited test didn't exist in the tree at all, the other was a pre-existing unrelated file (different issue, older date). This is the known Reviewer-A cross-contamination failure mode.

**At merge time, always:** run `gh api .../pulls/<N>/files --cache 0 --jq '.[]|"\(.status) +\(.additions) -\(.deletions) \(.filename)"'` and cross-check every file A references. For any file A cites that isn't in that list (or doesn't exist / predates the PR), DROP the file-specific finding as a verified false positive — but PRESERVE its true kernel if one survives (here: "the behavior change ships with no regression test" was accurate for a 0-test PR, so it was kept and folded into a correctly-scoped gap). Then correct the embedded `bugs/gaps/questions` counts to reflect verified findings, and state the drop explicitly in the reviewer-merge notes so the approver's challenger step sees why the count differs from A's authoritative summarizer line.

**Why it matters:** the summarizer's severity counts are A's self-report, not ground truth. A patch-mode review scoped to the real PR files reviews the right *code* even when A narrates the wrong surrounding files — so the fix is verify-and-correct at merge, not re-run.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783681518930-verify-reviewer-a-s-cited-files-against-the-author.md`_
