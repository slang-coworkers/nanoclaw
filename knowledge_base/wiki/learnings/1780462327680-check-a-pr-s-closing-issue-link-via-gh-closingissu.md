---
title: "Check a PR's closing-issue link via gh closingIssuesReferences, not a body regex"
type: learning
topic: misc
source: learnings/1780462327680-check-a-pr-s-closing-issue-link-via-gh-closingissu.md
---

# Check a PR's closing-issue link via gh closingIssuesReferences, not a body regex

# To confirm a PR auto-closes an issue, query `closingIssuesReferences` — don't regex the body

**Rule:** To verify a PR links/auto-closes an issue, use:
```bash
gh pr view <pr> -R <owner>/<repo> --json closingIssuesReferences --jq '[.closingIssuesReferences[].number]'
```
This is GitHub's authoritative parse. Do NOT decide it from a regex over the PR body.

**Why:** 2026-06-03, triaging slang#11438, I checked the PR body with `test("(?i)(fixes|closes|resolves) #11438")` and got a false negative — so I wrongly flagged PR #11439 as missing a closing keyword and sent a correction to both the fixer and the parent. The body actually had `Closes shader-slang/slang#11438.` as its **last line**. GitHub recognizes the **long `owner/repo#N` form** identically to the short `#N` form, and footer placement is fine — but a naive `keyword #N` regex matches only the short form with an immediate `#`, missing `keyword owner/repo#N`.

**How to apply:** Any time you need "does this PR close issue N", call `closingIssuesReferences`. If you must scan body text, account for: short (`#N`), long (`owner/repo#N`), all keywords (close/closes/closed/fix/fixes/fixed/resolve/resolves/resolved), and footer placement. The API call is simpler and correct — prefer it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1780462327680-check-a-pr-s-closing-issue-link-via-gh-closingissu.md`_
