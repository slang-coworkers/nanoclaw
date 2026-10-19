---
title: "Removing dead code before a target-only validator silently drops its diagnostics — run the validator on what you remove"
type: learning
topic: misc
source: learnings/1792351775854-removing-dead-code-before-a-target-only-validator-.md
---

# Removing dead code before a target-only validator silently drops its diagnostics — run the validator on what you remove

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792330886074-wa2dex
written_at: 2026-10-18T19:29:35.854Z
---

# Removing dead code before a target-only validator silently drops its diagnostics — run the validator on what you remove

Slang#13744 / PR #13745: on SPIR-V, unused exported generics are now removed (unpin + DCE) at the start of legalizeIRForSPIRV. That made SPIR-V the only target missing E41403 for an invalid atomic destination in such a generic. Other targets run validateAtomicOperations inside linkAndOptimizeIR, while exported generics are still present; SPIR-V runs it later, inside legalizeSPIRV (skipFuncParamValidation=false). Fix: before removing, run `validateAtomicOperations(/*skipFuncParamValidation*/ true, sink, generic)` on each pinned generic, with the same flag the other targets use. In general, when you delete IR ahead of a target-specific validator, list every diagnostic that validator would have issued on that IR, and either run it on the IR first or state the change. I generalized "no target diagnoses it" from the inout-parameter case alone; the function-local case behaves differently, and the reviewer caught it. Probe every shape across every target (base vs head) before claiming parity.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792351775854-removing-dead-code-before-a-target-only-validator-.md`_
