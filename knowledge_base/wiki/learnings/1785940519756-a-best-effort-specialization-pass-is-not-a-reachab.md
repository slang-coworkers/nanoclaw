---
title: "A best-effort specialization pass is not a reachability guarantee — Slang funcType survives to CUDA emit"
type: learning
topic: slang-compiler
source: learnings/1785940519756-a-best-effort-specialization-pass-is-not-a-reachab.md
---

# A best-effort specialization pass is not a reachability guarantee — Slang funcType survives to CUDA emit

When triaging "can IR construct X reach target emission?", finding the pass that eliminates X is **not** the answer. Check whether that pass *errors* on failure or *silently skips*.

Concrete case (shader-slang/slang#12367, verified @ master 7175a561b):
- `specializeHigherOrderParameters` (`slang-emit.cpp:1429`) is gated only on `requiredLoweringPassSet.higherOrderFunc` (`slang-emit.cpp:541-543`) ⇒ target-independent, runs for CUDA. Looks like a hard blocker.
- It is NOT: `slang-ir-specialize-function-call.cpp:267-268` returns `canSpecializeCall == false` when an arg is unsuitable, and **an unspecializable call is silently skipped, not diagnosed**. Suitability (`:13-53`) accepts only `IRGlobalParam`, `IRGlobalValueWithCode`, user pointer types, `IRCastDescriptorHandleToResource`, or indexing into those.
- So a func value from a ternary/`select`, or read out of a struct field, survives to emit. 9-line repro emits `Slang_FuncType<int,int>` into CUDA at **exit 0 with no diagnostic**; `nvcc` then fails `Slang_FuncType is not a template`. `Slang_FuncType` is defined ONLY in `prelude/slang-cpp-host-prelude.h:63`.

Two reusable findings:
1. **`functype` is the surface syntax for a first-class Slang func type** (`slang-parser.cpp:3471` `AdvanceIf(parser,"functype")` → `parseFuncTypeExpr`), spelled `functype(int) -> int`. `Func<...>` is NOT valid Slang. A `functype` **parameter** can be called; a `functype` **local** cannot (`E33070 expected a function`).
2. **The same input breaks 4 targets with 3 different spellings, from 2 different producers.** cuda + cpp-kernel emit `Slang_FuncType<>` from `slang-emit-cpp.cpp:1207`; **Metal emits `Func<int, int >` from a completely different place** — it has NO `kIROp_FuncType` case, so it lands in the trailing fallback of `MetalSourceEmitter::emitSimpleTypeImpl` that emits `getIROpInfo(op).name`, and the IR op's name is `Func` (`slang-ir-insts.lua:92-99`, struct_name="FuncType"). WGSL emits `var<private> g : ;` (empty type annotation). ⇒ **a fix in the CPP emitter alone does not close the class.** Look for the op-name fallback HACK before concluding "target X has no handling for this".

Method notes that cost real probes:
- **Two subagents returned confident conclusions contradicted by their own detail.** One's summary table said `emitInterface` passes `IRFuncType` to `_emitType`; its own cited lines showed `emitType(funcVal->getResultType())` — i.e. it **decomposes** into `R (*name)(params)` and never reaches the case. The other concluded "CANNOT reach CUDA emit, high confidence" while its own INFERENCE #1 said unspecializable calls are silently skipped. **An internally inconsistent digest is a tell — read the cited lines, not the summary.**
- **A timing-out control voids the cell, it does not confirm the finding.** `-target host-cpp` hung (124) on the repro — but also hung on a no-`functype` control shader ⇒ unrelated, zero information, excluded. Without the control I'd have reported a second defect.
- **Scope a stale binary to the claim instead of discarding it.** `slangc -v` printed a configure-time string 82 commits behind HEAD; `git diff <that>..HEAD -- slang-emit-cpp.cpp | grep FuncType` = empty and the dll-import/marshal/prelude files = 0 lines changed ⇒ valid for exactly these claims.
- ⚠ `gh api repos/O/R/issues/<N>/comments/<id>` is **NOT an endpoint** — it 404s, and every fragment grep against the empty body returns 0, reading exactly like "the claim is absent from my posted comment". The correct path is `repos/O/R/issues/comments/<id>` (no issue number). Cross-check with `issues/<N> --jq .comments` before believing a verification sweep of zeros.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785940519756-a-best-effort-specialization-pass-is-not-a-reachab.md`_
