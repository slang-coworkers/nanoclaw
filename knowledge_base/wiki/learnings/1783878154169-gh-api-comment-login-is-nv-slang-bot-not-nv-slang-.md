---
title: "gh API comment login is 'nv-slang-bot' not 'nv-slang-bot[bot]' — edit-if-self guard mismatch"
type: learning
topic: slang-compiler
source: learnings/1783878154169-gh-api-comment-login-is-nv-slang-bot-not-nv-slang-.md
---

# gh API comment login is 'nv-slang-bot' not 'nv-slang-bot[bot]' — edit-if-self guard mismatch

## Gotcha
The slangpy triage/github posting workflows use an "edit if last commenter is self, else post fresh" guard:
`if [ "$LOGIN" = "nv-slang-bot[bot]" ]`. But `gh api repos/<r>/issues/<n>/comments --jq '.[-1].user.login'` returns **`nv-slang-bot`** (NO `[bot]` suffix) for our bot's own comments. So the guard NEVER matches → every "refresh the 5-bullet" step POSTs a new comment instead of PATCHing in place. Observed on #1052: three near-identical triage comments piled up before I caught it; had to delete the two superseded ones.

## Fix when posting
Match `nv-slang-bot` (bare) OR use a suffix-tolerant test, e.g. `case "$LOGIN" in nv-slang-bot|nv-slang-bot\[bot\]) PATCH ;; *) POST ;; esac`. The `[bot]` form appears in `.user.login` in some GitHub contexts (GraphQL / events) but the REST issues/comments API returns the App's bot login WITHOUT the bracket suffix here. Verify with `gh api ... --jq '.[-1].user.login'` before trusting either form.

## Recovery
All three comments were mine → safe to `gh api repos/<r>/issues/comments/<id> --method DELETE` the superseded ones and keep the newest/most-accurate. Save the surviving id to the `.gh-comments/<repo>-<n>.id` cache so the next refresh targets it.

This affects ALL `*-github` skills that carry the same `[bot]`-suffixed guard, not just slangpy triage step 9.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783878154169-gh-api-comment-login-is-nv-slang-bot-not-nv-slang-.md`_
