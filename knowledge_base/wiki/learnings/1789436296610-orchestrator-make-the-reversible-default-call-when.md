---
title: "Orchestrator: make the reversible default call when an operator decision goes dark and an external party is blocked"
type: learning
topic: ci-tooling
source: learnings/1789436296610-orchestrator-make-the-reversible-default-call-when.md
---

# Orchestrator: make the reversible default call when an operator decision goes dark and an external party is blocked

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788169774244-t4l67b
written_at: 2026-09-15T01:38:16.610Z
---

# Orchestrator: make the reversible default call when an operator decision goes dark and an external party is blocked

## Rule

When I've escalated a **non-destructive, reversible** decision to the operator and it goes dark for days, AND an **external party (e.g. a repo maintainer) becomes actively blocked/waiting** on that same decision, make the sensible default call myself — with an explicit operator override off-ramp — rather than continuing to stall. Continuing to hold is the worse outcome: it leaves the external party hanging and wastes converged work.

This extends the "stalled handoffs are mine to chase (nudge/re-send)" rule: chasing isn't only nudging — when the blocked party is external and the pending decision is reversible, chasing includes *deciding*.

## Guardrails (all must hold before self-deciding)
- The action is **reversible / non-outward-facing beyond an already-open artifact** (e.g. draft-PR edits), not destructive.
- I gave the operator a real window + clear escalation(s) first (here: ~8 days, two dashboard escalations with the plan attached).
- There's **positive external mandate** — the maintainer who owns the merge explicitly requested the direction and was actively waiting ("if you're blocked by a human decision, let me know").
- I **notify the operator of the call with an explicit STOP/defer override**, and keep any genuinely separate feature decision **still parked** for them (don't over-claim authority — decide only what the external mandate covers).

## Concrete case — shader-slang/slang #12847 / PR #12848 (Sep 2026)
- Maintainer jkwak-work requested an architectural rework (first-class ballot IR op + backend SPIR-V emit) of a P3/low fix. I escalated proceed/defer + a related feature decision (proposal-2, native `OpGroupNonUniformIAdd`) to the operator with the fixer's converged plan.
- Operator went dark ~8 days. The maintainer then pinged the PR offering to unblock.
- I **greenlit the rework** (reversible draft-PR work, converged low-risk plan) with a clear operator STOP override, while keeping **proposal-2 parked** for the operator (a distinct feature/capability decision the rework didn't need).
- Validation: fixer implemented cleanly (all critiques green, GPU-verified), and the **maintainer took the PR off draft himself and drove it toward merge** — confirming the work was wanted. Operator never needed to override.

## Anti-pattern avoided
Treating an escalation as fire-and-forget ("it's queued, I'll wait") while a maintainer sits blocked. Escalating is not the same as owning; the chain owner still drives it to a resolution.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789436296610-orchestrator-make-the-reversible-default-call-when.md`_
