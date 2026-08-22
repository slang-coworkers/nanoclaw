---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-21T16:57:19.589Z
---

# Supervisor awaiting_us over-fires: uncredited bot comments + board-sync notices as human

Measured 2026-08-21 (supervisor tick 174): scan.py flagged **181 of 435 in-flight chains (42%) as action='nudge'**. After firing 59 and reading ~25 coworker replies, the large majority were **false positives** with two distinct, fixable root causes in `last_activity_by_us` / ball-direction computation:

1. **Our posted GitHub bot comment is NOT credited as `last_activity_by_us`.** R4 says a bot comment/review by us counts as our activity, but scan.py's `compute_last_activity_by_us` only reads `ncl` outbound rows (our session messages), not comments we posted to the GitHub issue/PR. So a chain where the triager already answered the maintainer *on GitHub* (e.g. #12634 our cmt 5364030556 at 01:20Z answered jkwak-work's 01:14Z question; #12426 cmt 5355291968; #12525 cmt 5366125324) reads as "human spoke last, unanswered by us" and nudges — when the ball is correctly with the maintainer. Fix would require pull-universe.sh to fetch the newest *bot* comment timestamp per chain and feed it into `last_activity_by_us`.

2. **An automated PR-board-sync notice posted through a human account counts as a human comment.** `jhelferty-nv` (and similar) post board-sync notices bodied "Automated notice (PR board sync) — do not reply to this comment. Auto-assigned @X as shepherd." Because the *author* is a human GitHub account, scan.py's "human spoke last" trips and marks the chain awaiting_us (#12653, #12620, #12591-adjacent). These are not live inbounds. Fix: treat comments whose body matches the board-sync sentinel ("do not reply", "PR board sync") as non-human, like bot comments.

**Also a pure false positive class:** human-authored PRs the bot was never involved in (slangpy-1045 author szihs, #12649/#12642 author jvepsalainen-nv) get a minted gh-issue session and flagged — the "human replies to CI/coderabbit bots" trips "human spoke last." These chains have zero bot comments ever; scan should suppress when bot has never been author/reviewer/mentioned.

**The nudges DID catch real work (mechanism is sound):** #12667 (fixer's build subagent stalled ~18h, never compiled — real miss, now rebuilding gated); #12655/#12659/#9257 (builds killed by ~23h-ago container restart — the 2026-08-20T22:44Z zombie cohort — resumed on nudge); #12606 (human un-drafted PR #12642 with 5 verification Qs — dispatched to fixer); #12620 (dependency #12419 merged, un-draft prompt sent). So the wake mechanism works; the *classifier* over-selects. Net: fire the genuinely-recent stalls, but expect ~60-70% of a large awaiting_us set to be park/handoff/false-positive until the two credit gaps above are fixed.
