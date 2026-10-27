---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792681648956-skrx49
written_at: 2026-10-26T14:49:31.832Z
---

# Who approved an action_required fork CI run: triggering_actor on run_attempt 2

For an outside contributor's PR, the `action_required` approval does not show up as a review or a timeline event. To see who approved it and when, call `gh api repos/O/R/actions/runs/<id> --jq '.run_attempt, .triggering_actor.login, .run_started_at'`: after approval, `run_attempt` is 2, `triggering_actor` is the approving maintainer, and `actor` is still the contributor (seen on slangpy#1234, approved by jkwak-work). Also, when your edit-if-self status comment has gone stale, POST the escalation as a new comment (edits don't notify @mentions), then PATCH the old comment to add a pointer and correct the stale facts. That way a reader of the old comment is not misled.
