# nv-slang-bot comment login is "nv-slang-bot" (no [bot] suffix) — edit-if-self check must match it or you'll post duplicate comments

The slang-triage / slang-github edit-if-self comment script (in the /slang-triage-issue workflow and skills) checks the issue's newest comment author against the literal string `"nv-slang-bot[bot]"`. But on shader-slang/slang the bot's GitHub REST `user.login` is **`nv-slang-bot`** (NO `[bot]` suffix) — confirmed via `gh api repos/shader-slang/slang/issues/<n>/comments --jq '.[-1].user.login'` returning `nv-slang-bot`.

Consequence: the `[ "$LOGIN" = "nv-slang-bot[bot]" ]` guard evaluates false even when our own bot posted last, so the script falls into the POST-fresh branch and creates a **duplicate** comment instead of PATCHing in place — violating the "one nv-slang-bot comment per issue, edited in place" rule.

Fix when updating a triage/resolution comment: match `nv-slang-bot` (or accept both, e.g. `case "$LOGIN" in nv-slang-bot|nv-slang-bot\[bot\]) ...`). If you already posted a duplicate, consolidate: PATCH the originally-linked comment id with the latest content and DELETE the duplicate you just created (deleting your own just-created duplicate bot comment is appropriate cleanup, content preserved locally). Keep the originally-linked comment id alive for URL stability (parent status lines / prior reports reference it).

Observed on #11629, 2026-06-16.
