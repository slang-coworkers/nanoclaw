---
title: "Reviewer combined-review fan-out can trigger a taskless-fixer echo loop via always-engage a2a wiring"
type: learning
topic: review-process
source: learnings/1782720540038-reviewer-combined-review-fan-out-can-trigger-a-tas.md
---

# Reviewer combined-review fan-out can trigger a taskless-fixer echo loop via always-engage a2a wiring

# Reviewer combined-review fan-out → taskless-fixer echo loop

**Symptom:** After a `/slang-pr-review` run, the `slang-fixer` peer floods the reviewer's inbox with hundreds of bare "No reply / Holding silently" messages, every few seconds, for days. Reviewer non-responses do NOT stop it.

**Root cause (diagnosed by orchestrator, Jun 2026, during shader-slang/slang#11779 review):**
- The reviewer's Step-5 `send_file(to="slang-fixer", path=combined-review.md)` fan-out **mints a new a2a wiring/channel** (reviewer→fixer) the first time it's used.
- That wiring is created with **`engage_mode=always`**, meaning *anything* landing on the channel re-wakes a fixer session — even when the fixer has **no actionable task** (e.g. the PR under review is a human-authored / external-contributor PR the fixer correctly declines to touch).
- A taskless woken session emits a "holding silently" status that routes back to the reviewer on the same channel → which (via always-engage) keeps the loop alive on the fixer side. It is **self-sustained on the fixer**, not driven by the reviewer.

**Levers that DON'T work:**
- Reviewer staying silent — scratchpad/no-reply doesn't reach the fixer; loop is self-triggered.
- `ncl groups restart` of the fixer — kills the current process but the always-engage **wiring remains**, so the next inbound re-establishes the loop. (A restart "landing" is necessary but not sufficient.)
- `ncl destinations remove` — only severs the fixer's *outbound* name on the edge; does NOT stop *inbound* re-wakes.

**The actual fix:** delete the **wiring** itself (`ncl wirings delete <wiring-id>`, operator-approval-gated). Once gone, nothing routes to the fixer on that channel and the loop can't re-establish. Add a restart afterward only if the live container is still emitting.

**Prevention / reviewer-side takeaway:**
- Sending a review artifact to a fixer that has no task can wake a runaway session if the wiring is always-engage. When the PR is contributor-owned / a draft (no bot fix expected), consider that the fixer fan-out may be unnecessary, or confirm the reviewer→fixer wiring isn't `engage_mode=always`.
- If the loop starts: don't try to fix it from the reviewer side — flag the **wiring id + engage_mode** to the parent/orchestrator (who owns `ncl wirings`). One escalation, then ignore the noise.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782720540038-reviewer-combined-review-fan-out-can-trigger-a-tas.md`_
