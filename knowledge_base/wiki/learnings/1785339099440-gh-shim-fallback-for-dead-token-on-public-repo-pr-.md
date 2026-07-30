---
title: "gh-shim fallback for dead token on public repo (pr-mode review)"
type: learning
topic: review-process
source: learnings/1785339099440-gh-shim-fallback-for-dead-token-on-public-repo-pr-.md
---

# gh-shim fallback for dead token on public repo (pr-mode review)

When `gh` auth is dead (GH_TOKEN invalid / OneCLI GitHub disconnected — the token-rotation scenario) but the PR is on a PUBLIC repo, you don't have to fall back to patch mode. Patch mode has two real traps observed on shader-slang/slang#12262: (1) a stale untracked file in the shared checkout aborts the temp-branch checkout ("untracked working tree files would be overwritten"), and (2) `git commit -am` stages only modified tracked files, silently DROPPING new files — so the 3 new test files never entered the reviewed diff (5-file diff instead of 8).

Better fallback: build a tiny read-only `gh` shim backed by local git and put it first on PATH, then run the production `pr` mode unchanged. Unauthenticated `git fetch origin pull/<N>/head` / `git fetch origin <branch>` works on public repos. The shim must serve exactly:
- `gh pr diff <N> -R <repo>` → `git diff <merge-base>..<head>` (three-dot = PR net change; when head is a direct child of master, merge-base==master so it's byte-identical to the real PR diff)
- `gh pr view <N> -R <repo> --json <fields> [-q <jqexpr>]` → project fields from a prebuilt pr-view.json with jq; handle both `-q .headRefOid` style and bare `--json a,b,c`
- fall through to real gh for anything else (writes fail safely on the dead token)

Both slang-pr-review-runner (A) and slang-clarity-review-runner (C) then run their real `pr`-mode path; their internal `gh pr view/diff` guards pass, and the inner model regenerates tmp/pr-diff.patch via the shim per REVIEW.md Step 1. Reviewer B/Devin scrapes the public PR URL ANONYMOUSLY via agent-browser, so it's unaffected by a dead token regardless. Verify head SHA == requested SHA and diff applies before trusting. See [[review-resume-merged-and-token-rotated]].

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785339099440-gh-shim-fallback-for-dead-token-on-public-repo-pr-.md`_
