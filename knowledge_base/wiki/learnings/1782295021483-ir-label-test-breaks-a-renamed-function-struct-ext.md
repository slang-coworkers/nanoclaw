---
title: "IR-LABEL test breaks: a renamed function (struct→extension) is not an opcode change — verify which one broke"
type: learning
topic: slang-compiler
source: learnings/1782295021483-ir-label-test-breaks-a-renamed-function-struct-ext.md
---

# IR-LABEL test breaks: a renamed function (struct→extension) is not an opcode change — verify which one broke

## slang #11700 Group 3 — coopvec `__init` IR-LABEL miss was a rename, not a vanished opcode

When an auto-generated `IR-LABEL`/`-dump-ir` test starts failing after a refactor, distinguish two very different failure modes before calling it intentional-vs-regression:
1. **The labeled function got renamed** → `IR-LABEL: func %X` is never found → FileCheck fails before it even checks the body. The compiler behavior may be fully intact.
2. **The opcode/IR shape genuinely changed** → the function is found but its body differs.

These look identical at the test level (red test) but mean opposite things.

### The concrete case
`design/ir-reference/values/aggregate-makecoopvector.slang` asserted `IR-LABEL: func %CoopVecx5Fx24init` (mangled `CoopVec.$init`) + `IR: makeCoopVector(%a,%b,%c,%d)`. After PR **#11480** ("Make native CoopVec differentiable", `da319e61a`) it failed.
- **Cause = rename only.** #11480 moved `__init<each U>(expand each U args)` out of `struct CoopVec` into `extension CoopVec<T,N> : IDifferentiable` (verify: `git show da319e61a -- source/slang/hlsl.meta.slang`). A member ctor mangles `CoopVec.$init`; an extension ctor mangles bare `$init` (`%x24init`). So the LABEL vanished.
- **Opcode did NOT change.** In the current `-dump-ir`, the specialized `func %x24init : Func(CoopVectorType(Int,4,…),Int,Int,Int,Int)` still emits per-element `makeCoopVector(%203,%204,%205,%206)` (4 operands) — exactly what the CHECK wanted. The `makeCoopVectorFromValuePack(<pack>)` form (also present, ~28×) is the **generic pre-peephole** shape; the peephole at `slang-ir-peephole.cpp:819` collapses it to per-element `makeCoopVector` when the pack is a concrete `IRTypePack` (unchanged since #6223). Construction is intact.
- **Fix** (owner did this in PR #11728): anchor the CHECK on the opcode, not the function label.

### Generalizable rules
- **Don't infer dumped IR shape from `.meta.slang` source alone.** The source intrinsic (`__makeCoopVec` → `kIROp_MakeCoopVectorFromValuePack`) only tells you the *pre-lowering* op; specialization + peephole passes decide what the `-dump-ir` actually shows. Reproduce the dump and read the *specialized* function body.
- **A "this CHECK was never correct" / "always emitted X" claim is a statement about a specific commit.** Verify it against the test's `//META: source_commit` (build/dump at that commit). If that commit isn't reachable in the repo, say "unverified at generation time" — do not assert it. (In #11700 I wrongly claimed the per-element CHECK was "never correct"; it would have matched at generation time — only the rename broke it.)
- **`git log -S "<OpcodeName>" -- source/slang/` is the fast attribution tool.** It immediately showed the coopvec opcode came from #6223 and was last touched by #11480 — and that the maintainer's hedged "cf. #11571" attribution was wrong (#11571 is generic pack-count constraints, touches no coopvec code).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782295021483-ir-label-test-breaks-a-renamed-function-struct-ext.md`_
