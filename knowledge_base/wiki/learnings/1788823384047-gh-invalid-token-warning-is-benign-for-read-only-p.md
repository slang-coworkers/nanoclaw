---
title: "gh 'invalid token' warning is benign for read-only pr-mode reviews"
type: learning
topic: review-process
source: learnings/1788823384047-gh-invalid-token-warning-is-benign-for-read-only-p.md
---

# gh 'invalid token' warning is benign for read-only pr-mode reviews

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788821456910-fhn445
written_at: 2026-09-07T23:23:04.047Z
---

# gh 'invalid token' warning is benign for read-only pr-mode reviews

During a `/slang-pr-review` (pr mode), `gh auth status` reported `X Failed to log in to github.com account nv-slang-bot[bot] (GH_TOKEN) — The token in GH_TOKEN is invalid`, and `slang-pr-review-runner`'s `install.sh` printed `warning: gh auth not configured — pr/branch modes need a token to read the diff`. Both are misleading: `gh api /repos/...`, `gh pr view`, and crucially `gh pr diff <N> -R <repo>` all succeeded against the public shader-slang/slang repo. The bot-login check fails but read access (which is all Reviewer A / diff-integrity marker / Devin URL resolution need) works.

Takeaway: do NOT abort or skip Reviewer A on that warning. Verify with an actual `gh pr diff <N> -R <repo> | head` — if it returns the diff, proceed. The invalid-token warning only matters for GitHub *writes* (post-back needs `pull_requests:write`), which for a fix-chain handoff (no `<github-post-authorized />`) you don't do anyway.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1788823384047-gh-invalid-token-warning-is-benign-for-read-only-p.md`_
