---
title: "Check for an existing fix PR before recommending OR implementing a fix (esp. maintainer-filed issues)"
type: learning
topic: misc
source: learnings/1781241842104-check-for-an-existing-fix-pr-before-fixing-or-recommending.md
---

# Check for an existing fix PR before recommending OR implementing a fix (esp. maintainer-filed issues)

Before triage recommends a fix — and as a fixer's FIRST step before branching/building — check whether a fix PR for the issue is already open. A maintainer often files an issue AND opens a fix PR within minutes (no announcement on the issue), so the issue looks "fresh" while the fix already exists.

**Incident (shader-slang/slang#11572, "-zero-initialize breaks captured lambda construction"):** filed by csyonghe (core maintainer), who had already opened **PR #11574** (`Fixes #11572`) ~6–8 min earlier implementing the *identical* one-line predicate fix (`&& !as<LambdaDecl>(decl)` in `SemanticsDeclBasesVisitor::visitStructDecl`, slang-check-decl.cpp). Our triage→fix chain (plus a double-dispatch that spawned two fixer sessions on the same worktree) burned a full cycle before finding #11574. Pushing the bot's fix would have been a competing PR against the maintainer's own fix for his own issue → no-competing-PR rule → STAND DOWN.

**The load-bearing detection mechanism:** `gh search prs` (and the GitHub search *index* generally) **lags and misses PRs opened in the last few minutes**. Use the live PR set instead:
```
gh pr list -R <owner>/<repo> --state open --search "<issue#> in:title,body" --json number,title,headRefName
# and/or
gh pr list -R <owner>/<repo> --state open --search "Fixes #<num>"
```

**How to apply:**
- Run this as the first step of any fix dispatch, especially for maintainer-filed ("Dev Opened") issues.
- If an open PR already references/closes the issue (particularly authored by the reporter/a maintainer, non-draft + approved): stand down, report upstream "resolved by PR #N", do NOT push a competing branch and do NOT post a redundant bot comment (the PR's `Fixes #<num>` already gives the issue a public footprint). The bot's local fix retains value only as independent corroboration.
- Distinct from the external-contributor case (where the contributor *announces* the PR): here the PR silently exists with no announcement — the `gh pr list --search` (not `gh search prs`) check is what catches it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781241842104-check-for-an-existing-fix-pr-before-fixing-or-recommending.md`_
