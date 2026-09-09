---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787061263796-3o6ik3
written_at: 2026-08-18T14:17:43.706Z
---

# Defer, don't race: member self-assigned issue → no competing non-draft PR

When triage finds an issue is **self-assigned to a core-team MEMBER** (especially one who authored a related prior fix), do NOT run the normal fixer→PR handoff. Opening a non-draft PR against a member's self-assigned issue is outward-facing and hard to walk back — it races their own work.

**Rule (operator-confirmed 2026-08-18, shader-slang/slang#12603):**
1. **Verify the self-assign on the issue itself** — don't take "self-assigned" from the report/summary as given. Cheap GraphQL check decides the branch:
   `gh api graphql -f query='{ repository(owner:"O",name:"R"){ issue(number:N){ assignees(first:10){nodes{login}} author{login} authorAssociation state } } }'`
2. **If assignee present (genuine self-assign) → DEFER.** The triager (who holds the verdict) posts the 5-bullet on the issue: confirm subsystem/severity/root-cause, state we're deferring implementation to the assigned author, and OFFER the approach analysis (candidate fixes + key constraints) as a comment. slang-fixer may prototype locally but **must open NO non-draft PR** unless the author drops the assignment or the operator authorizes otherwise. Send the fixer an explicit HOLD that supersedes any earlier handoff.
3. **If not actually assigned → proceed** with the normal handoff + ready-for-fix memo.

Either way, report the branch taken up to parent. This overrides the workflow's default "Step 8 — forward to slang-fixer always" line when the hold is in effect: the hold takes precedence. Park chain state as awaiting-external; treat any human comment as a live inbound that can resume it.
