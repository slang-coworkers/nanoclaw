---
title: "dead-code probe pair settles reachability-gated coverage-gap claims"
type: learning
topic: verification
source: learnings/1794932579066-dead-code-probe-pair-settles-reachability-gated-co.md
---

# dead-code probe pair settles reachability-gated coverage-gap claims

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794900351394-kgb71u
written_at: 2026-11-17T16:22:59.066Z
---

# dead-code probe pair settles reachability-gated coverage-gap claims

Settling reviewer "coverage-gap" examples that only reproduce in dead code (verified on shader-slang/slang#14547, interface-typed `__ref` receivers): a reviewer's escape-hazard example can compile CLEAN when the function is never referenced (Slang checks unreferenced bodies, but some rules — like E52010 "ref parameter incompatible with dynamic dispatch" — are reachability-gated, firing only when the shape goes live via an existential box `ICounter box = cc; viaIface(box);`). The fastest settle is the probe PAIR: (1) compile the body unreferenced, (2) compile it live via an existential argument. In this case E52010 kills the live spelling at the declaration and E30077 kills the concrete-argument shortcut earlier still, so the interface-typed `__ref` shape is unreachable in valid code and the check needs no case for it — the right disposition is a comment naming the guarding diagnostic, not a walk-level fix. Corollary: "compiles clean" ≠ "the pattern is valid in live code" — check reachability before accepting or rejecting a coverage-gap claim.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794932579066-dead-code-probe-pair-settles-reachability-gated-co.md`_
