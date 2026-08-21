---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787062309072-kjkfvs
written_at: 2026-08-20T08:16:40.352Z
---

# Whole-object bitcast fast path: four independent correctness gates, each caught only by a different check

Replacing field-wise AnyValue marshalling with a single whole-object `slang_bit_cast<AnyValueN>` (issue #12606, PR #12642) needs FOUR independent predicate gates, and each was caught by a *different* verification step — no single check would have found them all:

1. **ABI layout, not Natural layout** — caught by codex CODE_REVIEW reading the layout source. The box size and the field-wise packer use Natural rules (float4 → 4-byte align, dense); the whole-object copy uses the emitted C/CUDA ABI (CUDA float4 → 16-byte align). A padded `{float; float4}` is Natural-dense (20 bytes) but CUDA sizeof 32 → guard must compare against `getSizeAndAlignment(CUDA/C rules)`, not `getNaturalSizeAndAlignment`.

2. **Reject matrices** — caught by codex. Column-major matrices are walked column-by-column by the marshaller but stored row-contiguously in emitted `Matrix<T,R,C>` → whole-object copy reorders at identical size.

3. **Reject empty aggregates** — caught by running the FULL autodiff regression suite (NOT the targeted test). A type transitively containing a zero-size aggregate legalizes to a non-simple tuple; `legalizeInstWithOperands` (slang-ir-legalize-types.cpp) has no `kIROp_BitCast` case → aborts `InternalError: non-simple operand(s)!`. Reachable ONLY via the new fast path (field-wise `FieldAddress`/`Load` have tuple-aware handlers). This is why autodiff `s_bwdCallableCtx_*` contexts can't take the fast path (they wrap empty conformer contexts).

4. **Alignment <= 4** — caught by codex OUTPUT_REVIEW. Payload is a 4-aligned uint array; `slang_bit_cast<T>` reads through a `T*`, so a 16-aligned CUDA float4 read from a 4-aligned box is UB. Guard: emitted alignment must be <= payload alignment (4). Correctly makes the SAME float4 type fast-path on CPP (C-rules 4-align) but fall back on CUDA.

LESSON: for a "prove byte-compatibility or corrupt silently" optimization, the targeted FileCheck test passing means little — the real bugs surfaced in (a) an independent code reviewer reading layout/legalization source and (b) the FULL neighboring regression suite (autodiff), not the focused test. Run both, always. Also: `kIROp_BitCast` on an aggregate is NOT a stable code-size vehicle in general — it survives to emit only when the operand legalizes to `simple`; otherwise `lowerBitCast` dismantles it or type-legalization aborts.
