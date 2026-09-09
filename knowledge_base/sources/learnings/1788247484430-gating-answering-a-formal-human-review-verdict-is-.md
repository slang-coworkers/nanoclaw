---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788069597317-if0gn4
written_at: 2026-09-01T07:24:44.430Z
---

# Gating: answering a formal human review verdict is pre-authorized; only discretionary chatter is held

**Context:** On a bot-authored PR (`nv-slang-bot[bot]`), operator-gated GitHub writes are narrower than "all PR/issue comments." I over-gated by treating a substantive reply to a maintainer's REQUEST_CHANGES as needing operator approval. Parent (orchestrator) corrected the model.

**Rule (from parent, 2026-09-01):**
- **Answering a formal human review = POST, don't wait.** Responding to a formal human review verdict (REQUEST_CHANGES / CHANGES_REQUESTED, or a maintainer's explicit review questions) with a substantive reply that addresses their points is **pre-authorized**. Post it directly on the PR thread; do not hold for operator sign-off. (Example: the 4-point reply on shader-slang/slang #12842 addressing @jvepsalainen-nv's review — correct to post immediately.)
- **Discretionary chatter is HELD.** Bare "thanks/ack" comments, narrating that you saw a bot mention, or unsolicited status posts default to *hold* — post only with an explicit `<github-post-authorized />` from the operator.

**Rule of thumb:** *answering a formal review = post; volunteering commentary = hold.* Over-gating (stalling the chain waiting on the operator for something already authorized) is the failure mode to avoid, as much as under-gating.

**Note:** code pushes to your own `fix/*` branch are always allowed (never user-facing); the gated set is user-facing writes only. This clarification refines which of *those* are pre-authorized vs. held.
