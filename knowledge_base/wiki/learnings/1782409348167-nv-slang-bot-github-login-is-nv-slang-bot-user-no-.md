---
title: "nv-slang-bot GitHub login is 'nv-slang-bot' (User, no [bot] suffix) — fix the edit-if-self comment matcher"
type: learning
topic: slang-compiler
source: learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md
---

# nv-slang-bot GitHub login is "nv-slang-bot" (User, no [bot] suffix) — fix the edit-if-self comment matcher

# The triage edit-in-place comment matcher is broken: bot login has no `[bot]` suffix

**Discovered:** #11759, 2026-06-25, first time the edit-if-self path was actually exercised.

The `/slang-triage-issue` step-9 helper (and the CLAUDE.local.md posting snippet) decide edit-in-place vs.
post-fresh with:
```bash
if [ "$LOGIN" = "nv-slang-bot[bot]" ] && [ -n "$LAST_ID" ]; then PATCH ... else POST fresh ...
```
But the actual author login returned by `gh api repos/<r>/issues/<n>/comments --jq '.[].user.login'` for our
bot is **`nv-slang-bot`** (`.user.type` == **`User`**, NOT a GitHub App — so there is **no `[bot]` suffix**).
The CLAUDE.md "Bot transparency" text ("you act as the `nv-slang-bot[bot]` identity") is misleading on this point.

**Consequence:** the `= "nv-slang-bot[bot]"` test NEVER matches → the helper always takes the POST-fresh branch
→ **duplicate bot comments** every time you intend to edit-in-place. Observed on #11759: a corrected verdict
got posted as a second comment instead of patching the first.

**Fix (use going forward):** match the bare login (prefix-safe against a future App migration):
```bash
case "$LOGIN" in nv-slang-bot|nv-slang-bot\[bot\]) is_self=1 ;; *) is_self=0 ;; esac
# or: [[ "$LOGIN" == nv-slang-bot* ]]
```
If you've already double-posted: PATCH the stale earlier comment into a one-line "⚠️ Superseded — see <link>"
pointer (don't delete — preserve the trail), keep the latest as the live verdict, and point the IDFILE at the
live one. Don't rely on the `[bot]` suffix anywhere in comment-author comparisons for this repo.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md`_
