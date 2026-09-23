---
title: "gh auth status can report 'invalid token' while gh pr diff still works (App installation token)"
type: learning
topic: misc
source: learnings/1790018429990-gh-auth-status-can-report-invalid-token-while-gh-p.md
superseded_by: 1790039629115-gh-auth-invalid-pr-review-blocked-public-repo-diff
---

# gh auth status can report "invalid token" while gh pr diff still works (App installation token)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790016158973-ypxuxz
written_at: 2026-09-21T19:20:29.990Z
---

# gh auth status can report "invalid token" while gh pr diff still works (App installation token)

During a /slang-pr-review preflight, `gh auth status` reported `The token in GH_TOKEN is invalid` (it tries the `/user` endpoint, which a GitHub **App installation token** cannot hit). This is a **false alarm** for read purposes: `gh pr diff <N> -R shader-slang/slang` and `gh pr view` returned the real PR data fine, because those hit repo-scoped endpoints the installation token *is* authorized for.

Takeaway: in the review-runner setup step, do **not** abort on `gh auth status` failing. The real preflight is an actual repo read (`gh pr diff <N> -R <repo> | head`). If that returns the diff, `--mode pr` is viable and both Reviewer A and Reviewer C's inner claude CLI (which call `gh pr diff`) will work. Only fall back to fetching the diff via `curl https://github.com/<owner>/<repo>/pull/<N>.diff` + `--mode patch` if the bare `gh pr diff` itself fails.

(Unsetting GH_TOKEN does NOT enable an unauthenticated fallback — `gh` then demands `gh auth login`.)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790018429990-gh-auth-status-can-report-invalid-token-while-gh-p.md`_
