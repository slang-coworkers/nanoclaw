---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789434486505-f5hc06
written_at: 2026-09-15T02:54:34.211Z
---

# Coherent/volatile resource-load CSE miscompile: fix at readNone inference, and the front-end silent-qualifier-drop

From fixing shader-slang/slang#13082 (a `globallycoherent`/`volatile` ByteAddressBuffer read CSE'd across a store → silent `a+a`).

**Mechanism.** The read-only `ByteAddressBuffer.Load` methods are `[__readNone]` *unconditionally* (hlsl.meta.slang) — the coherent/volatile qualifier lives on the buffer *variable* (`IRMemoryQualifierSetDecoration`), invisible to the method decl. A `[noinline]` wrapper whose only callee is that `.Load` is inferred `readNone` transitively by `ReadNoneFuncPropertyPropagationContext::propagate` (slang-ir-propagate-func-properties.cpp) — *before* `.Load` is force-inlined — and the decoration persists (canProcess skips already-decorated funcs). `removeRedundancy` (run inside `deferBufferLoad`) then commons the two `call wrapper` insts: `isMovableInst`→`isPureFunctionalCall` (readNone) → `DeduplicateContext` structural GVN with NO clobber/between-store walk.

**Fix layer (non-obvious).** Must be the readNone *inference*, NOT `isPureFunctionalCall` and NOT `removeRedundancy`. The commoned inst is `call wrapper`; the wrapper *closes over the coherent global* (the buffer is not a call argument), so `isPureFunctionalCall` at the outer call can't see coherence — only the inference, which looks inside the wrapper at `call .Load(inData,…)`, can. Masking in removeRedundancy is wrong-layer (leaves readNone semantically wrong; over-restricts plain SRVs; readNone is the movability lever). So: in the inference's Call branch, deny readNone if a call arg reads a coherent/volatile resource (helper `resourceAccessTouchesCoherentOrVolatile` in slang-ir-util: bounded cycle-protected backward-slice over load/field-address/element-ptr + phi via `getPhiArgs`).

**Convergence insight.** The backward-slice terminates because the front end confines coherent/volatile to *global* resource declarations — provenance always bottoms out at a global; a function parameter can't carry the qualifier. This refutes the "chasing coherence through phis is non-convergent" worry *for this problem*.

**Front-end silent-qualifier-drop (distinct soundness bug, the true residual enabler).** A plain copy `ByteAddressBuffer x = inA;` (initialization) OR `x = inA;` (assignment) SILENTLY DROPS the coherent/volatile qualifier — zero diagnostic. Only the ternary/argument-binding path diagnoses the mismatch (`E30048`). Once dropped, a memory-routed handle (e.g. `ByteAddressBuffer sel[2]; sel[pick].Load(i)`) carries no coherence in the IR, so no IR-layer purity analysis can recover it — a genuine residual miscompile, but gated by the front-end drop, not the IR fix. Fix belongs at the semantic checker (preserve or reject the copy), tracked separately.

**Process note.** codex CODE_REVIEW found 3 successive provenance-routing variants (scalar var → SSA phi → local aggregate). Past the SSA-value layer, precise provenance tracing is non-convergent (Slang has no memory-SSA/reaching-store analysis). When that happens, escalate the design fork (precise vs conservative-over-restrict vs fix-the-producer) to the human rather than round-tripping codex indefinitely — the codex-critique skill's own "3 unresolved rounds → escalate" rule codifies this.
