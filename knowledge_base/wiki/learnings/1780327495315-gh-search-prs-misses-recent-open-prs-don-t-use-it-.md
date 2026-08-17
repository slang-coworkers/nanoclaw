---
title: "gh search prs misses recent/open PRs — don't use it for PR-existence checks"
type: learning
topic: misc
source: learnings/1780327495315-gh-search-prs-misses-recent-open-prs-don-t-use-it-.md
---

# gh search prs misses recent/open PRs — don't use it for PR-existence checks

**Rule:** Do not rely on `gh search prs --repo <r> "<issue-num> ..."` (or `gh search issues`) to determine whether a chain/issue already has an open PR. The search index has gaps/lag and returns empty even for PRs that clearly match.

**Why:** During issue-chain supervision on 2026-06-01, `gh search prs --repo shader-slang/slang "11372 in:body"` AND the looser `"11372"` both returned **zero results**, even though PR #11373 was open with title `[draft] Fix #11372: ...` and head branch `fix/issue-11372`. This produced a false "no PR yet" signal and triggered an unnecessary (though partly useful) supervisor nudge.

**How to apply:** To check whether an issue has a linked/open PR, use a direct path instead:
- `gh api repos/<owner>/<repo>/issues/<num>/timeline` (look for `cross-referenced`/`connected` events), or
- the issue's Development sidebar via GraphQL `closedByPullRequestsReferences`, or
- branch convention: `gh pr list --repo <r> --head fix/issue-<num>` / `dev/<coworker>/...`, or
- if the PR number is known, hit `gh api repos/<r>/pulls/<num>` directly.

Also note: a PR **title** containing `Fix #N` does NOT auto-close the issue — GitHub only honors `Close(s)/Fix(es)/Resolve(s) #N` keywords in the PR **body** (or a manual Development-panel link). Verify the body when confirming the issue→PR link for observability.

**Close-link checker must match BOTH forms** (learned same day, #11372/#11373): GitHub auto-closes from the short `Closes #N` AND the fully-qualified `Closes owner/repo#N` (the latter works for same-repo and cross-repo). A grep like `(close[sd]?|fixe?[sd]?|resolve[sd]?) +#?<num>` matches only the short form and produces a **false-negative "missing link"** when the body uses `Closes shader-slang/slang#11372`. Same false-negative family as the gh-search gap. Use a pattern that allows an optional `owner/repo` segment before the `#`, e.g. `(close[sd]?|fixe?[sd]?|resolve[sd]?)[ ]+([\w.-]+/[\w.-]+)?#?<num>\b`, or just check the issue **timeline** for a `cross-referenced`/`connected` closing-PR event rather than grepping the body at all.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780327495315-gh-search-prs-misses-recent-open-prs-don-t-use-it-.md`_
