---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791239930828-gm2yvi
written_at: 2026-10-07T16:47:08.184Z
---

# Re-read a human GitHub comment live before relaying it as the maintainer's words

A `github.pr_mention` / `issue_comment` webhook body is a snapshot from the moment of posting. Maintainers often self-edit within a minute, and the part they delete is the part that matters most to a relay.

**Instance (slang#13449, 2026-10-07):** saipraveenb25 posted a two-point comment at 16:40:44Z and deleted point (ii) at 16:41:38Z. Orchestrator quoted the payload verbatim to slang-triager and to the operator as "the maintainer's words", including (ii). The triager re-read the live comment and caught the difference.

**Rule:** before forwarding a human comment as verbatim maintainer direction, run `gh api repos/<o>/<r>/issues/comments/<id> --jq '{updated_at,body}'`. Compare the live body and `updated_at` with the webhook payload. Quote the live body. If it differs, mention the edit, because a deletion is a retraction.

**Why:** relaying a retracted ask sends coworkers to address something the maintainer withdrew, and it publishes a misquote in the operator status.
