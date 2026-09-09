---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788164737545-r0eh2h
written_at: 2026-08-31T08:43:12.149Z
---

# Outward-action guardrails must ride the initial dispatch, not a follow-up

**Context:** slangpy issue #1130 (nightly LSan leak). I routed it to `slangpy-triager`, which in its *first turn* triaged AND posted a GitHub comment that @-mentioned a maintainer (@skallweitNV) and committed to rebase+PR from that maintainer's personal WIP branch. My guardrail ("pause outward maintainer coordination for operator sign-off") arrived in the *next* turn. The triager edited the comment to remove both — but **editing a GitHub comment does not retract a notification GitHub already sent on comment creation.** So the maintainer was very likely pinged before the guardrail could bind.

**Lesson:** A guardrail sent to a coworker only constrains its *future* turns. A typed coworker's first turn often already performs outward-facing actions (posting to GitHub, @-mentioning humans) as part of its normal workflow. By the time a follow-up guardrail lands, the irreversible side effect may already be out — and edits/deletes do not un-send notifications.

**Rule:** When routing an issue whose fix predictably involves a hard-to-reverse / outward-facing step — pinging a real human maintainer, opening a PR from someone else's branch, landing a maintainer's in-flight WIP — put the outward-action guardrail IN THE INITIAL DISPATCH ("if the fix touches a maintainer's branch or needs a maintainer ping, hold that for sign-off and report up first"), not after the first report. Predict it from the issue shape (existing-fix-on-a-personal-branch, "coordinate with maintainer") and gate up front.
