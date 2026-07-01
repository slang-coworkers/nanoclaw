---
name: "#11837 Metal half-float literal suffix — SHIPPED (merged #11838)"
description: shader-slang/slang#11837 Metal FP-literal-suffix bug; fix MERGED via PR #11838 by jkwak-work 2026-07-01; NaN/Inf half/float still bare double = documented remaining gap
type: project
originSessionId: 869d7f28-2134-474f-af2d-7d2e8250fbc8
---
**RESOLVED / SHIPPED.** shader-slang/slang#11837 — `half`/`float` literals emitted to the Metal target with no MSL type suffix (`half h = 61440.hf` → bare `61440.0`, read as 64-bit double → `as_type<ushort>(61440.0)` is a 64→16-bit bit-cast MSL rejects). Pure emit-layer gap: `MetalSourceEmitter::emitSimpleValueImpl` ignored the (correct) IR literal type. Fix appends `h`/`f` for finite half/float literals (mirrors the WGSL emitter); double/untyped stay bare. **PR #11838 MERGED to master by maintainer jkwak-work on 2026-07-01** — he merged it himself, so no bot-initiated (operator-gated) merge was involved. Regression test `tests/metal/float-literal-suffix.slang` + 3 baseline updates landed; worktree/sentinel cleaned up.

**Remaining known gap (documented, out-of-scope):** `half`/`float` NaN/±Inf literals still emit the bare double-typed `(0.0/0.0)` form — a separate pre-existing path. #11838 used `Addresses` (not `Fixes`), so the merge did NOT auto-close #11837; the NaN/Inf gap stays tracked for the maintainer's float-literal series (#11783). If a follow-up webhook lands on #11837 about NaN/Inf, this is the piece — the finite-literal fix already shipped.

**Suffix-validity Q (resolved, don't re-litigate):** jkwak-work asked (issuecomment-4848438922) whether `61440.hf` is valid / should be just `h`. Verified at HEAD 6d355565c: `h`/`H`/`hf`/`HF`/`fh`/`FH` all = 16-bit `half` literal (`h` ≡ `hf`; `hf` is the language-reference example form); no-suffix=float, `l`/`lf`=double, unknown suffix→E39999. Sources: parser `parseFloatingPointLiteralExpr()` (slang-parser.cpp:8906-8921), lexer (slang-lexer.cpp:974-1049), docs expressions-literal.md.
