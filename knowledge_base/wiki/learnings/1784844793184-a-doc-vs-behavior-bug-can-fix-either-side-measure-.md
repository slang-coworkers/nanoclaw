---
title: "A doc-vs-behavior bug can fix either side — measure the behavior-fix cost before assuming code is the 'real' fix (slang #11682)"
type: learning
topic: slang-compiler
source: learnings/1784844793184-a-doc-vs-behavior-bug-can-fix-either-side-measure-.md
---

# A doc-vs-behavior bug can fix either side — measure the behavior-fix cost before assuming code is the "real" fix (slang #11682)

**Case:** slang#11682 — `slangc -g0` (and the no-`-g` default) help text said "Don't emit debug information at all," but the SPIR-V emitter still emits `OpSource`/`OpName`/`OpMemberName` (name hints for reflection/disassembly; `OpLine` + rich NonSemantic debug ARE correctly suppressed). A doc-vs-behavior mismatch.

**Outcome:** After a long exploration of the *behavior* fix (make `-g0`/None actually strip names), the maintainer (@jkwak-work) chose the **docs-only** fix — merged PR #12201 (commit `b629210213`), 3 files +7/−2, `pr: non-breaking`, zero behavior/test change. Final help text: "Don't emit debug information. This is the default. For SPIR-V, OpSource, OpName and OpMemberName are still emitted."

**Meta-lesson (the important one):** A doc-vs-behavior bug has two valid fix sides. Don't assume the "real" fix is the code change. Here, *measuring the cost of the behavior fix* is exactly what steered the maintainer to the cheap correct doc fix:
- Attempt 1 (flip default `-g` None→Minimal so names are "intended"): defeated front-end optimizations (loop-inversion, buffer-deferral) on EVERY default textual compile + crashed the interpreter — far bigger than "adds line info."
- Attempt 2 (gate names on None so default strips them): broke ~273 existing tests whose no-`-g` CHECKs reference OpName-derived friendly ids, and changed default SPIR-V output for all users.
- The maintainer, shown these measured costs, chose: don't change behavior, fix the doc. One-line help-text edit.

So: when triaging a "docs say X, code does Y" issue, cost the behavior fix (test churn, output changes, opt-shape effects) *before* recommending it. The doc fix is often correct and ~free; surfacing the behavior fix's true blast radius is the triager's highest-value contribution.

**Two verified compiler facts recovered along the way (still true even though the PR reverted to docs-only — useful for future work):**
1. **`stripDebugInfo` dangling-decoration bug** (`slang-ir-strip-debug-info.cpp`): its removal switch lists `kIROp_DebugFunction` but NOT `kIROp_DebugFuncDecoration`, AND it recurses via `getChildren()` — which per `getFirstChild()` (`slang-ir.cpp`) starts *after* the last decoration, so it structurally cannot see decorations. Result: it frees the `IRDebugFunction` but leaves the `IRDebugFuncDecoration` (whose operand[0] = that function) dangling → IR-serialization operand-map miss / crash. General rule: **a strip/DCE pass that deletes an inst must also delete decorations referencing it, and must traverse `getDecorationsAndChildren()` not `getChildren()` or it can't see decorations.**
2. **Debug level silently changes textual codegen shape.** At `Minimal`+, `IRDebugLine` insts are interleaved into blocks during lowering, BEFORE `stripDebugInfo` (emit.cpp, None-only) runs. `invertLoops`'s `isSmallBlock()` (`slang-ir-loop-inversion.cpp`) counts ordinary insts against a threshold of 4 and does NOT exclude `IRDebugLine` → tips small loop-cond blocks over → inversion disqualified. `deferBufferLoad` treats `IRDebugLine` as side-effecting (`mightHaveSideEffects()==true`) → stops deferring loads. So raising `-g` changes generated code for textual targets, not just debug output. (This is why the None→Minimal default flip had a suite-wide opt-shape cost.)

**Method note:** across ~14 maintainer round-trips the fixer's mechanism read was wrong twice (blamed the VM-emitter `default:` unimplemented arm — hit 0×; called an option "byte-identical" when it wasn't). Each was caught by verifying against source / instrumenting to ground truth before it reached the maintainer. Verify load-bearing claims at HEAD before relaying them into a public verdict or a maintainer-facing comment.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784844793184-a-doc-vs-behavior-bug-can-fix-either-side-measure-.md`_
