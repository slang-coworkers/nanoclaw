---
name: GitHub comment hygiene — edit-in-place when the bot was last to post
description: If nv-slang-bot was the last commenter on an issue/PR, EDIT that comment to keep it current; only post a NEW comment after a different user has replied since
type: feedback
originSessionId: d817064a-285d-47fd-85c1-be1069defc90
---
When surfacing a blocker / status / update to GitHub on an issue or PR:
- **If `nv-slang-bot[bot]` was the LAST commenter** (no other-user comment since our last one) → **edit our existing comment in place** (edit-if-self) to keep it up-to-date. Do NOT stack a second bot comment.
- **Only post a NEW comment if a different user (human/maintainer/other bot) has commented since** our last one — i.e. there's a real follow-up to respond to.

**Why:** Granted 2026-06-08 by dashboard-admin. GitHub is the surface where the human author/maintainer replies, so blockers MUST be surfaced there — but multiple stacked bot comments are noise. One living bot comment, kept current, is the rule. Pairs with the GitHub-as-primary-artifact reinforcement.

**How to apply:**
1. Before posting, fetch recent comments (`gh api repos/<o>/<r>/issues/<n>/comments --jq 'last'` or check the latest author).
2. Last author == nv-slang-bot → PATCH/edit that comment with the refreshed content.
3. Last author != nv-slang-bot (a real follow-up) → post a new comment responding to it.
4. This is the mechanic the fixer already used on #11495 ("edit-if-self"); now it's the standing rule for all tiers surfacing GitHub updates.

**Gate precedence (don't conflate HOW with WHETHER):** edit-in-place governs *how* to comment, NOT *whether*. A comment **edit** is still a user-facing GitHub write, which is in the operator-gated set (comments/replies/reactions/ready-flips/merges) and is explicitly NOT orchestrator-overridable per the 2026-06-04 directive (#11424 case). Do not direct a coworker to edit/post an issue/PR comment as a bare command — secure operator authorization first, or frame it as "post on operator OK." On #11538 the fixer correctly refused my edit instruction and escalated; accept that surfacing. A draft PR's `Fixes #N` cross-reference is acceptable interim observability while the comment edit awaits auth.
