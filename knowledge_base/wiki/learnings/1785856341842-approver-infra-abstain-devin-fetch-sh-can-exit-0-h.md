---
title: "[approver/infra-abstain] devin-fetch.sh can exit 0 having scraped the PR description instead of Devin's analysis — a false-clean"
type: learning
topic: review-approval
source: learnings/1785856341842-approver-infra-abstain-devin-fetch-sh-can-exit-0-h.md
---

# [approver/infra-abstain] devin-fetch.sh can exit 0 having scraped the PR description instead of Devin's analysis — a false-clean

**Symptom.** On shader-slang/slangpy#1078, `devin-fetch.sh --url .../pull/1078 --out <ws>/review` exited **0** (the success code), but the produced `review/devin-flags.md` contained the **PR description and diff** — not Devin's analysis — and had **no flags section at all**. The Devin page itself reportedly displayed **"2 Flags"**, whose content was never captured.

**Root cause.** The scrape landed on / captured page content before Devin's analysis pane was populated (or captured the wrong pane entirely), and the script's success criterion doesn't verify that what it wrote is actually a Devin verdict. Exit 0 means "the fetch pipeline ran", not "an analysis was captured". The workflow's documented contract — exit 0 ⇒ return devin-flags.md, exit 2/3/4 ⇒ `DEVIN_SKIPPED` — has no rung for "exited 0 but the artifact is not a review".

**Why it matters (this is the false-safe).** On the Devin-only tier — which is exactly where bot-authored / fixer-branch PRs land, since production `claude-pr-review` skips them and `harvest-reviews.py` returns exit 20 — Devin is the **sole** review signal. An empty-but-exit-0 scrape then synthesizes as `bugs: 0, gaps: 0, questions: 0, reviewers_complete: true`, i.e. "reviewed and clean", when nothing was reviewed. Those zeros are indistinguishable from a genuine clean review unless you look at the artifact. Here there were two known flags whose content we never saw. Absence of captured findings is **not** a finding of no issues.

**How to catch it.** Never trust Devin's exit code alone — **validate the artifact**. Before treating a Devin run as a signal, check that `devin-flags.md`:
- contains a flags/findings section (or an explicit "no flags found" statement from Devin itself), not just PR prose;
- is not a near-copy of the PR body/diff (if it starts with the PR description, the scrape missed the analysis pane);
- reconciles with any flag **count** visible on the page — "N Flags" with zero flag bodies captured is a hard fail.

Have the Devin subagent report the count-vs-content mismatch explicitly, and treat any mismatch as `DEVIN_SKIPPED`, not as clean. Delegating Devin to a subagent helps here: it saw the "2 Flags" header and rejected its own exit-0 result rather than passing an empty artifact upstream.

**Fix.** On rejected/false-clean Devin + no harvested bot review, set `reviewers_complete: false` in the synthesized doc's `_approver_result` block so Step 2 reads harness-integrity fail ⇒ `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`. Also carry an explicit `counts_meaningful: false` and a `notes` field saying the zeros mean "no signal obtained", not "reviewer found nothing" — a bare `0` in a ledger row is otherwise read as clean by anyone auditing later. Longer term `devin-fetch.sh` should exit non-zero when it cannot find an analysis pane, and should assert a captured flag count matching the page's header.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785856341842-approver-infra-abstain-devin-fetch-sh-can-exit-0-h.md`_
