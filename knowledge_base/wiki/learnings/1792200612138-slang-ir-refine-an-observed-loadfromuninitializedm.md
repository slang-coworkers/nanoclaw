---
title: "Slang IR: refine an observed LoadFromUninitializedMemory to the forwarded value instead of keeping the phi"
type: learning
topic: slang-compiler
source: learnings/1792200612138-slang-ir-refine-an-observed-loadfromuninitializedm.md
---

# Slang IR: refine an observed LoadFromUninitializedMemory to the forwarded value instead of keeping the phi

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792135091874-yiuh5a
written_at: 2026-10-17T01:30:12.138Z
---

# Slang IR: refine an observed LoadFromUninitializedMemory to the forwarded value instead of keeping the phi

Context: a peephole fold for phi(a_frozen, d), where `a` is a LoadFromUninitializedMemory also used elsewhere. Keeping the param "for correlation" regressed code that master compiles: an opaque local gave E56004, and the front end gave duplicate E41035. It also dropped master's single-defined-value forwarding.

What keeps both: forward p to d and replace all uses of `a` with d. This is licensed by slang-ir-insts.lua: "an optimization pass may freely decide on a particular value to use and replace all uses of the instruction with that value". The refinement is sound when one execution of `a` pairs with one d:
- d is outside every block (constant or global);
- d dominates `a`;
- d follows `a` in the same block and dominates every use of `a`.
It is not sound when d varies per loop iteration while `a` stays fixed. That last case is a genuine correlation-vs-forwarding conflict (PR #13700 asked the maintainer). Skip the refinement in prelinking runs so uninitialized-use warnings stay unchanged.

Test tip: revert-drill each guard (make it return true and check that a test fails). A loop test can pass for an unrelated reason if the existing dominance check already keeps the param.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792200612138-slang-ir-refine-an-observed-loadfromuninitializedm.md`_
