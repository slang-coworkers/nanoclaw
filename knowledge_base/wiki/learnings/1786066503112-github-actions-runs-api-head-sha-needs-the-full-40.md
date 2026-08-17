---
title: "GitHub Actions runs API: head_sha needs the FULL 40-char sha — a short sha silently returns total_count 0"
type: learning
topic: misc
source: learnings/1786066503112-github-actions-runs-api-head-sha-needs-the-full-40.md
---

# GitHub Actions runs API: head_sha needs the FULL 40-char sha — a short sha silently returns total_count 0

Cost me a wrong conclusion mid-check, and the failure direction is the dangerous one.

**The trap.** `gh api "repos/OWNER/REPO/actions/runs?head_sha=<SHORT>"` does **not** resolve abbreviated SHAs. It returns `total_count: 0`, HTTP 200, rc=0, no warning — indistinguishable from "this commit genuinely has no workflow runs."

Measured on shader-slang/slang, 2026-08-07:

```bash
gh api ".../actions/runs?head_sha=88fa1206" --jq '.total_count'                                    # → 0
gh api ".../actions/runs?head_sha=0000000000000000000000000000000000000000" --jq '.total_count'     # → 0   (control)
gh api ".../actions/runs?head_sha=88fa1206d3141e9b922b6e7fbf2f78fb9640427d" --jq '.total_count'     # → 92
```

Note the short sha is byte-identical in result to a **bogus all-zeros sha**. So if you're checking "does this commit have CI coverage?", a short sha manufactures the exact alarm the check exists to detect — a **false negative that reads as a coverage gap**. I briefly concluded a master commit was uncovered when it had a full 36-job green merge-queue run.

Worse: if you *drop* the filter or pass it in a form the API ignores in some other client, you can get the opposite — a populated list of unrelated runs that looks like an answer. Either way the query silently answers a different question than the one you asked.

**Fix.** Resolve to the full sha first, and keep a bogus-sha control in the same breath:

```bash
FULL=$(gh api repos/OWNER/REPO/commits/master --jq '.sha')
gh api "repos/OWNER/REPO/actions/runs?head_sha=$FULL&per_page=100" \
  --jq '.workflow_runs[] | "\(.conclusion // .status) | \(.name) | \(.event)"'
```

`0` on the control + non-zero on the real query is what makes the result trustworthy. Applies to `.../commits/<sha>/check-runs` too — prefer full SHAs everywhere in the Actions/Checks APIs.

**General rule this is another instance of: absence of an error is not evidence a filter was honored.** Same family as `ncl` silently ignoring `--all`/`--agent-group-id` at group scope (returns your own rows, rc=0, looks like a successful wider query). Any filter you rely on for a *negative* conclusion needs a control value that proves the filter is live.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786066503112-github-actions-runs-api-head-sha-needs-the-full-40.md`_
