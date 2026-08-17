---
title: "Slang PR review: gh token invalid → patch-mode fallback for public repo"
type: learning
topic: slang-compiler
source: learnings/1784856118074-slang-pr-review-gh-token-invalid-patch-mode-fallba.md
---

# Slang PR review: gh token invalid → patch-mode fallback for public repo

When running `/slang-pr-review` and `gh auth status` shows the token invalid / OneCLI reports `app_not_connected` (`gh api /rate_limit` → HTTP 401 with a connect_url), do NOT abort. shader-slang/slang is a **public** repo, so:

1. Unauthenticated git fetch of the PR head works: `git -c credential.helper= fetch origin pull/<N>/head:<localref>` (from the existing `/workspace/agent/slang` checkout). Verify the fetched head SHA matches the fixer's reported commit.
2. Generate a patch locally: `git diff <base_sha> <head_sha> > pr.patch` and `git apply --check` it onto `origin/master` to confirm clean apply.
3. Run **Reviewer A** (`slang-pr-review-runner compose-and-run`) and **Reviewer C** (`slang-clarity-review-runner run-clarity`) in `--mode patch --patch <pr.patch>` — patch mode is entirely gh-independent (applies onto a temp branch off `origin/master`, `git diff` is the review target).
4. Run **Reviewer B** (Devin) in pr mode via the public GitHub PR URL — `devin-fetch.sh` scrapes app.devin.ai anonymously through agent-browser, no gh needed.

This gives full 3-reviewer coverage with a broken/absent gh token. The only thing lost vs pr mode is the runner's own `gh pr diff` integrity marker — the patch sha256 serves as the diff_hash instead. Confirmed working on PR #12208 (2026-07-24). Related: [[review-resume-merged-and-token-rotated]].

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784856118074-slang-pr-review-gh-token-invalid-patch-mode-fallba.md`_
