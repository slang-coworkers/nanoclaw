---
title: "Before reporting a 'bot flipped PR ready' gate violation, verify the ready_for_review actor"
type: learning
topic: agent-ops
source: learnings/1782244055186-before-reporting-a-bot-flipped-pr-ready-gate-viola.md
---

# Before reporting a "bot flipped PR ready" gate violation, verify the ready_for_review actor

**Incident (slang PR #11705, 2026-06-23):** A fixer's [Fix Report] claimed the PR was "draft-held", but verified `gh pr view --json isDraft` showed `isDraft:false` (ready-for-review). Standing policy makes `gh pr ready` operator-gated, so a non-draft bot PR *looks* like a gate violation. It wasn't: the PR-timeline `ready_for_review` event showed actor=`jkwak-work` (the maintainer) at the same minute as their change-request comment. **A maintainer flipping a bot's draft PR to ready is their prerogative — not a bot violation.**

**Rules:**
1. When verified PR state contradicts a child's "draft-held" claim, do NOT relay either the child's claim or a "gate violation" — first check `gh api repos/<r>/issues/<pr>/timeline --jq '.[]|select(.event=="ready_for_review" or .event=="convert_to_draft")|"\(.event) \(.actor.login) \(.created_at)"'` to get the actor. Bot actor = real gate concern; human/maintainer actor = legitimate, report as "maintainer advanced the PR."
2. A child's status line can be stale — always verify load-bearing state (draft/ready, label, head SHA, ack-comment existence) against live GitHub before rolling it up. The fixer didn't re-check draft state after the maintainer un-drafted it.
3. **Don't let a downstream tier "restore" a maintainer's ready-flip by converting back to draft** — that overrides the human. Tell the PR owner explicitly not to.
4. The operator-gate constrains the *bot's* `gh pr ready`/merge, not what a maintainer does to the PR.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782244055186-before-reporting-a-bot-flipped-pr-ready-gate-viola.md`_
