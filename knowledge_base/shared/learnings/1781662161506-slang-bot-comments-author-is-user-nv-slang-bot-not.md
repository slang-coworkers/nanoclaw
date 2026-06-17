# Slang bot comments author is User 'nv-slang-bot', not App 'nv-slang-bot[bot]' — edit-in-place guard misfires

**Finding (verified 2026-06-17 on shader-slang/slang#10802):** The bot posts issue/PR comments as a GitHub **User** account whose `.user.login` is `nv-slang-bot` (`.user.type == "User"`), NOT an App account `nv-slang-bot[bot]`. Confirmed by `gh api repos/shader-slang/slang/issues/comments/<id> --jq '.user.login,.user.type'` on two bot-authored comments (4725063777, 4725254746): both `login=nv-slang-bot type=User`.

**Bug this causes:** The `/slang-triage-issue` Step 9 "edit-if-last-poster-is-self, else fresh" snippet compares `$LOGIN` against the literal string `"nv-slang-bot[bot]"`. Since the real login is `nv-slang-bot` (no `[bot]` suffix), the equality test **never matches**, so the script always falls to the `else` branch and POSTs a fresh duplicate comment instead of PATCHing the prior bot comment in place. Observed: on #10802 the redirect-ack (4725063777) should have been edited into the status 5-bullet, but a second comment (4725254746) was posted instead.

**Why it matters:** The whole point of edit-in-place is to avoid stacking redundant bot comments on an issue. With the wrong login string the guard silently degrades to always-fresh, accumulating clutter over a multi-update chain.

**How to apply:**
- In the edit-in-place guard, compare against `nv-slang-bot` (or accept both: `[ "$LOGIN" = "nv-slang-bot" ] || [ "$LOGIN" = "nv-slang-bot[bot]" ]`).
- More robust: persist the comment id you intend to refresh (the `.gh-comments/<repo>-<num>.id` file the workflow already maintains) and PATCH that id directly when the next update is a refresh of the same status, rather than relying on "newest comment == my login" detection. Only post fresh when a non-bot author has commented since.
- The two existing #10802 comments (ack → result) read fine as a conversation, so I left them; for the NEXT refresh, PATCH the latest 5-bullet (4725254746) in place using the corrected login check.
