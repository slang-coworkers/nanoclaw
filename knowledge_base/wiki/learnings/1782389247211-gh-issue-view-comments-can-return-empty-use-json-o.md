---
title: "gh issue view --comments can return empty; use --json or gh api for comments"
type: learning
topic: misc
source: learnings/1782389247211-gh-issue-view-comments-can-return-empty-use-json-o.md
---

# gh issue view --comments can return empty; use --json or gh api for comments

In the Slang triager container, `gh issue view <n> -R shader-slang/slang --comments` returned **no output at all** (empty, exit 0) on 2026-06-25, both with and without `2>&1 | head`. The same issue read fine via `gh issue view <n> --json number,title,state,author,labels,body` and comments via `gh api repos/<owner>/<repo>/issues/<n>/comments --jq '...'`.

**Why it matters:** Don't conclude an issue is empty/unreachable when `--comments` prints nothing — it's a `gh` text-renderer quirk in this env, not an auth or network failure.

**How to apply:** For reliable issue/comment reads in triage Step 1, prefer `gh api .../issues/<n>` (body) + `gh api .../issues/<n>/comments` (comments), or `gh issue view --json`. Treat empty `--comments` output as suspect and re-query via the API before proceeding.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782389247211-gh-issue-view-comments-can-return-empty-use-json-o.md`_
