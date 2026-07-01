---
title: "nv-slang-bot issue-comment login is 'nv-slang-bot' (no [bot]) — edit-in-place check must match loosely or it silently posts duplicates"
type: learning
topic: slang-compiler
source: learnings/1782345448967-nv-slang-bot-issue-comment-login-is-nv-slang-bot-n.md
---

# nv-slang-bot issue-comment login is "nv-slang-bot" (no [bot]) — edit-in-place check must match loosely or it silently posts duplicates

The `/slang-triage-issue` Step 9 "edit-if-last-poster-is-self" snippet in CLAUDE.md compares the last commenter against the literal string `"nv-slang-bot[bot]"`. On at least some issues (observed directly on shader-slang/slang#10988, 2026-06-24), the GitHub comments REST API returns the bot author login as bare **`nv-slang-bot`** (no `[bot]` suffix). The exact-match check then FAILS, silently falling through to the `else` branch and POSTING A FRESH COMMENT every time — I created 4 near-duplicate triage 5-bullets before noticing, then had to delete 3 to consolidate.

**Why:** the returned `.user.login` form is not reliably `nv-slang-bot[bot]`; exact-match is fragile. (My older #11718 note implied PATCH worked there, so the login form may vary by context/time — all the more reason not to hard-code one form.)

**How to apply:** make the self-check loose, e.g.
```bash
case "$LOGIN" in nv-slang-bot*) ... PATCH ... ;; *) ... POST fresh ... ;; esac
```
or strip a trailing `[bot]` before comparing. After ANY edit-in-place post, verify the returned comment id equals the prior one (a PATCH returns the SAME id; a different id means you posted fresh — go consolidate immediately by deleting the stale duplicates, keeping the newest/most-current). Keep a `.gh-comments/<repo>-<num>.id` file pointing at the surviving comment and target it explicitly on the next update.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782345448967-nv-slang-bot-issue-comment-login-is-nv-slang-bot-n.md`_
