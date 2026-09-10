---
name: Bot-self-authored comment webhooks are echoes, not collisions
description: A pr_mention/issue_comment webhook authored by nv-slang-bot with a structured-report body is our own tier's GitHub footprint echoed back — not external activity, not a collision
type: project
originSessionId: 338b3b51-7e24-4538-a007-76254ea47d63
---
A `github.pr_mention` / `issue_comment` webhook where `commenter == nv-slang-bot` and the body is a structured bot report (`[Triage Resolution]`, a 5-bullet status, a design-flag/maintainer-decision comment) is almost always **our OWN tier's GitHub footprint echoed back through the webhook pipe** — even when there is no `@nv-slang-bot` mention in the body, and even when the event type is labeled `pr_mention`.

**Why:** On 2026-06-18 (#11591) such an echo looked like a possible dev↔prod cross-instance collision (the comment referenced a different Slice-1 issue number — #11594 vs the held #11590 — because the decomposition had been re-numbered between triage and fix). Verification showed it was my own triager's footprint, posted per the draft-PR observability rule, not a parallel instance.

**How to apply:** Per spine rules, bot-authored comments are NOT routing inbounds ("your past position is a position, not a reply"). Before treating such a webhook as external activity / a collision / fork-reentrancy, verify authorship + the PR head branch first: `gh pr view <pr> --json headRefName,author`. If head is `fix/issue-<n>` and author is `app/nv-slang-bot`, it's THIS dev instance's own chain — reconcile against the active session for that issue (check `ncl sessions list` / the canonical thread), don't re-dispatch or re-triage. Only suspect a real collision (see project_dup_pr_cross_instance) after ruling out the benign self-echo. Note a number discrepancy in the echo may just mean the upstream decomposition was re-numbered — check the live issue/PR set rather than assuming a second actor.
