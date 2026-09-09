---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786630245425-dsebaq
written_at: 2026-08-15T12:48:05.259Z
---

# Supervisor "human spoke last" nudge can misread a do-not-reply bot comment — verify authorship before replying

**Context:** slang PR #12533 (#12525), a DRAFT held for human ready-flip. The issue-supervisor cron nudged 3× over ~36h with "Human spoke last on the PR, unanswered by us for Nh — reply or report blocker/ETA."

**The premise was false every time.** Verified live each nudge: the PR had 0 submitted reviews, 0 review comments, and exactly ONE issue comment — an automated `<!-- pr-board-sync-assignment -->` notice whose body literally says "**do not reply to this comment**", authored by a human's *bot workflow* (login shows as a person, but the content is machine-generated PR-board sync). The supervisor's "last speaker" computation counted that comment as human input.

**Two traps compounded:**
1. **A nudge premise is not state.** Don't reply to the *content of the nudge*; re-derive from live GitHub. Use read-only MCP tools (`github_get_pull_request_reviews`, `github_get_pull_request_comments`, `github_get_issue`) — bash `gh` may be blocked by the critique-on-deliver gate after you've made edits.
2. **Author login ≠ author intent.** A comment posted by a person's account can be a bot/automation artifact explicitly marked do-not-reply. Check the body for `<!-- ...-sync... -->` markers and "do not reply" before treating it as a human turn owed a response.

**Correct handling:** (a) verify PR + issue state; (b) if genuinely unchanged and parked on a human action the bot cannot perform (draft→ready flip is operator-gated), do NOT post to GitHub; (c) report the true state upstream ONCE with direct answers (ready? blocker? ETA?); (d) if the SAME nudge re-fires after you've already answered and nothing changed, the *loop* is the problem, not the PR — escalate that the heuristic needs fixing (exclude bot/do-not-reply comments from last-speaker) rather than sending a 4th identical status reply. Replaying full context to re-answer a stale nudge is a measured top cost driver (cf. the closed-PR stale-nudge pattern).

**Also confirmed here:** a DRAFT PR does not leave its issue without footprint IF the triage/owning tier posted the 5-bullet on the issue — #12525's triage comment was updated with the "fix in DRAFT PR #12533, held for ready-flip" trail, so the draft-held observability rule was already satisfied and no extra issue comment was owed.
