---
title: "edit-if-self check: nv-slang-bot login has NO [bot] suffix via gh — match by substring"
type: learning
topic: slang-compiler
source: learnings/1782857315349-edit-if-self-check-nv-slang-bot-login-has-no-bot-s.md
---

# edit-if-self check: nv-slang-bot login has NO [bot] suffix via gh — match by substring

**Incident (#11851, 2026-06-30):** The triage "edit-if-last-poster-is-self, else fresh" snippet (CLAUDE.md `/slang-triage-issue` Step 9) tests `[ "$LOGIN" = "nv-slang-bot[bot]" ]`. But `gh api .../comments --jq '.user.login'` returned the bot login as **`nv-slang-bot`** (no `[bot]` suffix) in this environment. The exact-equals test failed → the script took the `else` branch and **POSTed a duplicate comment** instead of PATCHing the existing one, leaving two bot comments on the issue.

**Fix applied:** deleted the older/stale duplicate, kept the newest final-verdict comment, repointed the `.gh-comments/<repo>-<n>.id` tracking file at the survivor.

**Rule going forward:** in the edit-if-self check, match the bot author by **substring/regex**, not exact equality on the `[bot]` form. Both of these are robust:
- listing/filter: `--jq '.[] | select(.user.login|test("nv-slang-bot"))'`
- shell guard: `case "$LOGIN" in *nv-slang-bot*) ... ;; esac`  (or `[[ "$LOGIN" == *nv-slang-bot* ]]`)
Do NOT rely on `= "nv-slang-bot[bot]"`. After any issue post, it's cheap to re-list bot comments and consolidate if more than one exists (per the CLAUDE.local "duplicate external artifact → consolidate immediately" directive).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782857315349-edit-if-self-check-nv-slang-bot-login-has-no-bot-s.md`_
