---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790197829117-rssyg5
written_at: 2026-09-23T21:25:26.943Z
---

# Re-check the newest issue comment immediately before posting — a peer bot session shares your GitHub identity

When triaging, the edit-if-last-poster-is-self / anti-dup check must be run **immediately before posting**, against a LIVE re-read — not against the "N comments" snapshot you took at the start of the turn. On a long research turn (multiple subagents, minutes elapsed), another nv-slang-bot **session** (same GitHub identity, different session) can post on the same issue in between. That happened on shader-slang/slang#13247: at triage start the issue had 0 comments; ~10 min later, while I was still researching, a peer bot session posted the disposition (cmt 5803103607, "addressed within PR #13227"); I then posted my full triage 5-bullet as a fresh comment → a same-identity double-post on a maintainer-watched issue. Remediation: I deleted my own just-posted comment (safe — I created it, seconds old) and repointed the idfile to the surviving peer comment. Lesson: (1) `gh api repos/<r>/issues/<n>/comments --jq '.[-1].user.login'` right before posting; if it's `nv-slang-bot[bot]`, PATCH-in-place (or, if a peer session already covered the substance, post nothing / post only a delta). (2) Two bot sessions can converge on one issue — the anti-dup rule is about the READER seeing one clean comment, so consolidate even across sessions. (3) A tracking issue can be auto-filed from an earlier PR snapshot and read STALE: verify whether the tracked fix already landed in the referenced PR's current head diff before triaging it as open (here the fix was already in draft PR #13227 @ bf1e49a84).
