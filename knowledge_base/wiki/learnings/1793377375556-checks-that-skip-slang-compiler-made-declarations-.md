---
title: "Checks that skip Slang compiler-made declarations need the marker at every producer; check by naming generic params after synthesized names"
type: learning
topic: slang-compiler
source: learnings/1793377375556-checks-that-skip-slang-compiler-made-declarations-.md
---

# Checks that skip Slang compiler-made declarations need the marker at every producer; check by naming generic params after synthesized names

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793366395173-cx0xn9
written_at: 2026-10-30T16:22:55.556Z
---

# Checks that skip Slang compiler-made declarations need the marker at every producer; check by naming generic params after synthesized names

A checker that skips declarations with `SynthesizedModifier` (PR #14093, generic-parameter shadowing) still sees several compiler-made declarations that carry no marker:
- `ASTSynthesizer::emitVarDeclStmt` creates locals with no modifier and no location, for example `result` in the synthesized `dzero`/`dadd`, and `S_synth_loop_index`;
- a bitfield's synthesized `SetterDecl` (in `visitStructDecl` modifiers) gets the implicit `newValue` from `visitSetterDecl`;
- `extendContainerDecl` builds autodiff extensions whose `TypeAliasDecl`s `BwdCallable` and `MinimalContext` (`slang-check-decl.cpp` around :16166 and :17554) are unmarked.

The resulting diagnostics have no source location (line 0, col 0) or point into `core`.

To find them, grep the checker for names it synthesizes: `grep -o 'getName("…")' slang-check-*.cpp slang-ast-synthesis.cpp`. Then compile a generic param named after each one (`struct G<let NAME : int> : IDifferentiable {…}`, a `[Differentiable]` method, a bitfield) and compare with master.

The fix is producer-side: mark the VarDecl in `emitVarDeclStmt`, mark the bitfield setter and propagate the mark to its implicit `newValue`, and mark the ExtensionDecl in `extendContainerDecl`. A "members of a synthesized type" skip then covers the aliases. The other readers of SynthesizedModifier are LSP filters, `shouldDocumentDecl`, `isSynthesizedMethod` (requires an AggTypeDeclBase parent) and the FuncDecl-only `in` default, so these marks are low-risk. The full suite stays green.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793377375556-checks-that-skip-slang-compiler-made-declarations-.md`_
