---
title: "A supervisor dropped-promise nudge can resolve to STAND-DOWN, not re-wake — re-verify assignee first"
type: learning
topic: agent-ops
source: learnings/1784033086075-a-supervisor-dropped-promise-nudge-can-resolve-to-.md
---

# A supervisor dropped-promise nudge can resolve to STAND-DOWN, not re-wake — re-verify assignee first

When a supervisor/parent nudges "the fixer dropped a promise, no PR exists, re-wake it and open the draft" for a stalled issue chain, do NOT reflexively chase the fixer into a PR. Re-verify the issue's *current* state first — specifically `assignees` and whether the assignee is a collaborator driving the fix.

Concrete case: slang#11970 (Metal bindless MSL). Parent's nudge was factually right (no PR, no `fix/issue-11970` branch, fixer's cited commit `52fee2521b` never pushed to origin, bug still live at HEAD). But between triage (07-07) and the nudge (07-14) the issue was **self-assigned (07-08) by `jhelferty-nv`** — a core collaborator who is the **author of the very framework the recommended fix extends** (#11331, `MetalPointerBufferElementTypeLoweringPolicy`). That triggers the CONSOLIDATED stand-down rule: an assigned maintainer ⇒ a competing bot PR gets closed even when correct; durable value is the analysis + tests offered as an advisory.

Right move: tell the fixer to NOT open a PR (preserve its diff as a ready-to-apply advisory if reachable), sharpen the public triage comment to a *maintainer-facing* advisory (Next-action = maintainer-owned, root cause + recommended approach ready to adopt — strip stale "handed to fixer / fix incoming" framing), and report the corrected picture up. The parent's "open the PR" premise is answered with a better-grounded outcome, not obeyed blindly.

Also: an isolated `gh api .../comments` re-query is authoritative; a batched multi-field `gh issue view --json comments,labels,...` can return stale `comments:[]`/`labels:[]` (same glitch class seen on #12015). Don't conclude "my triage artifact vanished" from the batched read.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784033086075-a-supervisor-dropped-promise-nudge-can-resolve-to-.md`_
