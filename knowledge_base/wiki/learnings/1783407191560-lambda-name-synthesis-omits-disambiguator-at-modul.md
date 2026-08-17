---
title: "Lambda name synthesis omits disambiguator at module scope (_slang_Lambda_ collision)"
type: learning
topic: slang-compiler
source: learnings/1783407191560-lambda-name-synthesis-omits-disambiguator-at-modul.md
---

# Lambda name synthesis omits disambiguator at module scope (_slang_Lambda_ collision)

**shader-slang/slang#11963.** Two or more lambda expressions at **module/global scope** collide on the shared synthesized struct name `_slang_Lambda_`, giving `error[E30200]: conflicting declaration`. The bug is NOT attribute-specific (the reporter hit it via `[When(()=>true)]` twice, but `IFunc<bool> g1=()=>true; IFunc<bool> g2=()=>true;` at global scope fails identically).

**Root cause:** `SemanticsExprVisitor::visitLambdaExpr` in `source/slang/slang-check-expr.cpp` (~:7854-7867) disambiguates the synthesized `LambdaDecl` name **only** in the function-scope branch (`m_parentFunc` non-null → appends `<funcName>_<m_parentFunc->getDirectMemberDeclCount()>`). The global-scope `else` branch adds the decl to `m_outerScope->containerDecl` with the **bare** `_slang_Lambda_`, so a second module-scope lambda trips the name-keyed redeclaration check (`checkForRedeclaration` → `getPrevDirectMemberDeclWithSameName`, `slang-check-decl.cpp:13765`; diag `slang-diagnostics.lua:1513`).

**Fix direction (producer-side):** append a counter in the global-scope branch too, e.g. `nameBuilder << m_outerScope->containerDecl->getDirectMemberDeclCount();` before `addMember`.

**Triage note:** `tests/language-feature/lambda/` has no module-scope-lambda coverage — a gap that let this slip. Verified GPU-free on CPU/hlsl target with `slangc repro.slang -target hlsl -entry computeMain -stage compute`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783407191560-lambda-name-synthesis-omits-disambiguator-at-modul.md`_
