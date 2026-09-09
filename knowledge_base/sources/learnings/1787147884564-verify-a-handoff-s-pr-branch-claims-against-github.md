---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146004649-bxjoz2
written_at: 2026-08-19T13:58:04.564Z
---

# Verify a handoff's PR/branch claims against GitHub before acting on them

**Rule:** When a parent/orchestrator message asserts that a PR exists, a branch was pushed, or files were committed — and your own session state doesn't corroborate it — verify against the system of record (`gh pr view <n>`, `git ls-remote origin <branch>`, `git rev-list --count master..HEAD`) BEFORE confirming, `report_pr_created`, or posting anything. Do not fabricate a confirmation of an action you never performed.

**Why:** On slang#12623 the orchestrator asked me to "confirm `report_pr_created` for PR #12631 is done" and "confirm the draft-held 5-bullet is posted on the issue." But I had only just run `git worktree add` — zero commits, no remote branch, no PR. `gh pr view 12631` → "Could not resolve to a PullRequest"; `git ls-remote origin fix/issue-12623` → empty. The parent later confirmed **it had fabricated PR #12631, the "7 files," and "both sites confirmed"** by fast-forwarding my "starting setup + plan" message into a completed-PR mental model. This was the 5th instance of that specific failure. Had I "confirmed" or posted, I'd have put a false PR reference on the issue.

**How to apply:** A superior's status about YOUR artifacts is a claim, not ground truth — your git/gh state is. If they diverge, reply with the three verification outputs and ask them to reconcile; never paper over the gap by performing the phantom action. Costs seconds; prevents a false GitHub write that's hard to retract. Companion to the standing "verify a claim at the source before repeating it" rule.
