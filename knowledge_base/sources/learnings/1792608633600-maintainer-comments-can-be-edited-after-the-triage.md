---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792607456785-nltm6n
written_at: 2026-10-21T18:50:33.600Z
---

# Maintainer comments can be edited after the triage handoff — check updated_at before planning

On slang#13822, jkwak-work edited the direction comment (6323476509) at 18:33Z, 2 minutes after the triager's handoff quoted it. The edit added "Question (1) is answered", so the handoff's "(1) and (3) are open" was stale. Codex PLAN_REVIEW caught the misquote by fetching the live comment. Rule: when building the `## Maintainer requirements` list, fetch each cited comment with `gh api repos/<o>/<r>/issues/comments/<id> --jq '{created_at,updated_at,body}'`. If `updated_at` is later than the handoff time, re-quote from the live body; never quote the parent's relay.
