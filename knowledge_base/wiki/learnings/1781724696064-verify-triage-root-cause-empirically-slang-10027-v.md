---
title: "Verify triage root cause empirically — slang#10027 vector-default-N synthesized-ctor cross-module abort"
type: learning
topic: slang-compiler
source: learnings/1781724696064-verify-triage-root-cause-empirically-slang-10027-v.md
---

# Verify triage root cause empirically — slang#10027 vector-default-N synthesized-ctor cross-module abort

**Rule:** Before implementing a triaged Slang fix, empirically confirm the triage's claimed root-cause mechanism (instrument + backtrace), especially for "InternalError: Generic type/value shouldn't be handled here!" aborts. A plausible, detailed triage trace can still name the wrong inst/decl.

**Case (slang#10027, 2026-06-17):** Triage (even after human re-triage by @jkwak-work) claimed a `static const int4 Var` imported from a precompiled `.slang-module` aborts because the deserialized vector's element *count* returns as `DeclRefIntVal(N)` instead of `ConstantIntVal(4)`; recommended fixing AST count serialization. **Refuted empirically:** a probe in `visitVarExpr` showed the count is a correct `ConstantIntVal`; `getVectorType` (slang-ast-builder.cpp:690, canonicalizes only `ConstantIntVal`) was never called with a `DeclRefIntVal`. The real abort (addr2line backtrace on a Debug build) is `ensureDecl(T)` on the element *type* param `T` (slang-lower-to-ir.cpp:14513/14515), reached while lowering the imported `Var`'s **initializer** `{0,0,0,1}` — a synthesized `$init` constructor. AST dump: `$init`'s lexical owning generic (owns `T`) is `GenericDecl@A`, but the ctor declRef's base `GenericAppDeclRef` is on a **different** `GenericDecl@B` — two un-reconciled copies of the synthesized `vector<T,4>` extension generic across the serialize→import boundary, so `T` never binds.

**Why size 4 only:** `core.meta.slang:2267` `__generic<T=float, let N:int=4> struct vector` — 4 is the **default N**, so the synthesized ctor for `vector<T,4>` is an extension generic over only `T` (N pinned to literal 4). Verified size sweep: int1/int2/int3 import clean (exit 0), only int4 aborts (exit 255). int3's `$init` is concrete `$init(int,int,int)` (no residual `T`).

**Why:** Following the wrong root cause (serialize the count) would not fix the abort and would touch the wrong subsystem. The real defect is a cross-module **synthesized-constructor extension decl-identity / dedup** gap — high blast radius (synthesized-ctor synthesis + module-AST serialization), maintainer-domain; a lowering-site guard would be a mask. codex independently confirmed all of this (PLAN/CODE/OUTPUT approve).

**How to apply:** For module serialize→deserialize/import bugs, the single-file round-trip often does NOT reproduce — use a 2-file `import`-of-precompiled-module repro. Instrument and read the *actual* backtrace before trusting a triage's named inst. Reusable repro pattern at tests/bugs/link-time-constant-array-size-*.slang (precompile lib + importer; value check with `-r ...slang-module`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781724696064-verify-triage-root-cause-empirically-slang-10027-v.md`_
