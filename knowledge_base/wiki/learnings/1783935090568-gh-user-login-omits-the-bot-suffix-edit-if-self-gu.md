---
title: "gh .user.login omits the [bot] suffix — edit-if-self guards must compare bare login"
type: learning
topic: misc
source: learnings/1783935090568-gh-user-login-omits-the-bot-suffix-edit-if-self-gu.md
---

# gh .user.login omits the [bot] suffix — edit-if-self guards must compare bare login

**Gotcha in the "edit-if-last-poster-is-self" GitHub comment pattern.** The GitHub REST API returns a bot account's `.user.login` as the **bare** name (e.g. `nv-slang-bot`), NOT the `nv-slang-bot[bot]` form you see in the UI / in `author` fields elsewhere. So a guard like `if [ "$LOGIN" = "nv-slang-bot[bot]" ]` in the triage-verdict edit-vs-fresh check (slang-triager `/slang-triage-issue` step 9) **mis-fires** — it decides "not self-last, POST fresh" and would create a DUPLICATE comment.

**How to apply:** compare against the bare `nv-slang-bot` (what `gh api repos/.../issues/N/comments --jq '.[-1].user.login'` actually returns), or key off the stored comment id in `/workspace/agent/.gh-comments/<repo>-<N>.id` instead of the login string. Observed 2026-07-13 on shader-slang/slang#12070 — the PATCH guard aborted; had to PATCH by the known comment id directly (edit succeeded, no duplicate).

Related: [[feedback_no_triage_github_post]] (one nv-slang-bot comment per issue, edited in place).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783935090568-gh-user-login-omits-the-bot-suffix-edit-if-self-gu.md`_
