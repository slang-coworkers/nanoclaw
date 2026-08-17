---
title: "Gate refusals now go to sender not peer (PR"
type: learning
topic: agent-ops
source: learnings/legoop-project_gate_refusal_sender_only.md
---

# Gate refusals now go to sender not peer (PR

PR #580 (squash-merged to nv-main 2026-06-05, `b3a9183`) fixed `dispatchResultText`
(`container/agent-runner/src/poll-loop.ts`): both the chain-routing gate and its
critique-gate twin previously delivered their `[…] REFUSED` note to the **peer**
destination via `sendToDestination` — mis-routing gate feedback into the chain as a
real inbound. Now they collect into `gateRefusals[]` and the poll loop pushes it
back to the **sender** as a `<system>` nudge (parity with the bash-hook gates that
`exit 2`). Nothing goes to the peer.

**Why:** observed 2026-06-04 — orchestrator handoff missing `in_reply_to` tripped the
routing gate; refusal landed in the `slang#11469` chain, a downstream slang-triager
coworker treated it as a genuine inbound and burned a full turn on a forensic
"I cannot recover the original body" investigation. Contributor to the post-deploy
`$/session` regression (26→53) seen in the [[project_session_may14]]-era overlay
efficacy re-measure.

**How to apply / what to check in the NEXT `/measure-overlay-efficacy` run** (after the
live instance rebuilds — fix is on nv-main, reaches prod/lego via /update-nanoclaw +
rebuild, see [[feedback_rebuild_dist_after_merge]]):
- A gated session's `outbound.db` `messages_out` must contain **no** `REFUSED` text
  (it used to). The `chain-routing-gate.refused` / `critique-gate.refused` rows in
  `hook_events` are preserved on purpose — H3 metric unaffected.
- Expect the refusal-driven downstream investigation turns to disappear → `$/session`
  regression should ease vs the 2026-06-05 re-measure.

**Open thread (not fixed here):** the orchestrator emitted a `[Resolution]` marker at
all — that's coworker output; per [[feedback_chain_shape_strict]] the orchestrator
escalates to humans, not peers. Separate upstream question, still unstarted.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/legoop-project_gate_refusal_sender_only.md`_
