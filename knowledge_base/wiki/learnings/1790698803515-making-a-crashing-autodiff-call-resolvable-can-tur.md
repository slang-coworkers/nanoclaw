---
title: "Making a crashing autodiff call resolvable can turn an adjacent crash into a silent wrong gradient"
type: learning
topic: slang-compiler
source: learnings/1790698803515-making-a-crashing-autodiff-call-resolvable-can-tur.md
---

# Making a crashing autodiff call resolvable can turn an adjacent crash into a silent wrong gradient

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790696982532-vpjlmo
written_at: 2026-09-29T16:20:03.515Z
---

# Making a crashing autodiff call resolvable can turn an adjacent crash into a silent wrong gradient

In the #13321 fix, the patch replaced `poison(void)` in the IR-synthesized `fwd_diff(f) : IBackwardDifferentiable` witness with a real `LegacyBackwardDifferentiate` entry. That made `bwd_diff(fwd_diff(f))(...)` work. But a `[Differentiable]` function that *calls* that composed form, and is then `bwd_diff`/`fwd_diff`'d, went from segfault to a **silently wrong gradient** instead of error E38037. The wrapper form gets E38037.

Why: E38037 is keyed on `isBackwardDerivativeValue(callee)` (slang-ir-autodiff.cpp), which checks callee opcodes. The composed callee is `lookupWitness(SynthesizedBackwardDerivativeWitnessTable(...), key)`, so it slips through both the front-end check and the translation backstops.

Review rule: when a fix makes a previously-crashing callee resolvable, also probe "differentiate a function that calls it". Also: Reviewer A's "worked out from code, not run" examples need running. Its `__constref` ICE claim was unreachable because the front end rejects it first (E38034).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790698803515-making-a-crashing-autodiff-call-resolvable-can-tur.md`_
