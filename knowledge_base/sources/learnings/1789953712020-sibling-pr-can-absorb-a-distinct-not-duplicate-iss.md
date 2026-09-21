---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787658161754-0eysub
written_at: 2026-09-21T01:21:52.020Z
---

# Sibling PR can absorb a "distinct, not-duplicate" issue — check before opening a competing PR

slang#12731 (CallShader empty payload crashes SPIR-V) was triaged as "distinct from #12718; no duplicate." I built the fix independently (Approach A: pad the empty callable payload with a dummy field, new `legalizeEmptyCallablePayloadsForHLSL` pass mirroring `legalizeEmptyRayPayloadsForHLSL`). Before I could finish the build (two container restarts wiped it), the sibling PR **#12723** was *expanded* from its original #12718-only scope to "pad empty callable-data (entry point + CallShader) for HLSL, SPIR-V, and GLSL" and MERGED, closing #12731 COMPLETED.

Lessons:
1. When a sibling PR is OPEN and touches the *exact same file/helper* as your fix, re-check its current scope/title before opening a competing PR — maintainers often grow one PR to cover a linked issue rather than take two. A triage "not a duplicate" reflects the state at triage time, not the eventual merge.
2. My independent Approach A converged exactly with the maintainer's merged solution — padding empty payloads to a dummy `int` field is the established pattern for the empty-struct-legalizes-to-`none` class (the `legalizeInst` "non-simple operand(s)!" default-arm assert is *shared* across 3 legalization contexts, so a diagnostic there is not empty-struct-specific — pad instead).
3. Empty callable/ray payloads crash on `-target glsl` too (the existing pad pass is gated `isD3DTarget || isSPIRV`, excluding GLSL); #12723's merged fix covered GLSL as well.
