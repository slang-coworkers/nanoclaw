---
title: "CONSOLIDATED — GitHub posting policy (verified ⇒ post; only ready+merge gated)"
type: learning
topic: agent-ops
source: learnings/1781405000000-CONSOLIDATED-github-posting-policy.md
---

# CONSOLIDATED — GitHub posting policy (verified ⇒ post; only ready+merge gated)

**Authoritative as of 2026-06-16 (operator dashboard-admin).** This consolidates and SUPERSEDES the earlier, contradictory posting learnings: `1780967604052` (don't post triage verdicts / terminal-state-only), `1781223197774` (all writes token-gated), `1781240652257` (issue_opened-no-mention → no post), and the posting-half of `1780949124265` (skip post on maintainer design issue). All are marked superseded.

## The policy

1. **nv-slang-bot has posting authority.** A **verified** 5-bullet (status / link / verdict / next-action / blocker) is POSTED to the originating issue/PR as the durable artifact — proactively, by the closest-to-the-state tier.
2. **Post on EVERY triaged issue**, including `issue_opened` webhooks with **no** `@nv-slang-bot` mention, and maintainer-authored issues. Silence on an in-flight chain is the bug. (#11599 — a full triage that posted nothing — is the failure this fixes.)
3. **The ONLY operator-gated GitHub actions are `gh pr ready` (un-draft) and `gh pr merge`.** Those write to the maintainer's review queue / default branch. Everything else — comments, 5-bullets, labels, Issue Type, replies, reactions — posts on the bot's own authority.
4. **The one remaining guard: verify at HEAD before posting.** "Verified" = repro reproduced OR load-bearing claims (file:line, API, label-applicability) checked against actual repo HEAD (`git merge-base`). This is the #11483-retraction guard — the real axis is *verified vs unverified*, never *interim vs terminal*.

## What the `<github-post-authorized />` token actually is

It is the **reviewer's** gate, and ONLY the reviewer's. `/slang-pr-review` posts its review to GitHub only when the dispatch carries the token — which `slang-github-webhook` emits when a human tagged `@nv-slang-bot` (an explicit invitation to reply). Without it, the reviewer returns its review via `send_file` for internal A2A handoff to the fixer — because the chain fixes internally before the PR is public, so no public review comment is needed. The token leaked into triager/fixer memory and got over-generalized into "all writes gated" — that over-generalization is RETIRED. Triage and fixer comments are NOT token-gated.

## Comment hygiene (unchanged)

One nv-slang-bot comment per issue. If the bot is still the last poster, **PATCH the existing comment in place** with the full refreshed 5-bullet (no duplicate). If a human/other-bot posted since, add a **fresh** comment carrying only the delta. Never delete an already-seen comment. Exclude confidential GitHub Project/board fields (priority, sprint, estimate) from public comments.

## Tier ownership (closest-to-the-state)

- **Triager** posts the verified triage 5-bullet on the issue (every triaged issue). Parking the fix-forward (no viable bot output) does NOT mean silence — still post the verdict.
- **Fixer** posts the PR (`Closes #N`) and replies on threads once verified; PR stays a draft until operator authorizes `gh pr ready`.
- **Reviewer** posts to GitHub only when a human tagged the bot (the token); otherwise hands off to the fixer via `send_file`.
- **Orchestrator** does not post on others' behalf; escalates to the operator ONLY for `gh pr ready` / `gh pr merge`.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781405000000-CONSOLIDATED-github-posting-policy.md`_
