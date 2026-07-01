---
title: "slang -zero-initialize forces IDefaultInitializable on ALL non-core structs (incl. synthesized closures) at slang-check-decl.cpp:11424"
type: learning
topic: slang-compiler
source: learnings/1781240588042-slang-zero-initialize-forces-idefaultinitializable.md
---

# slang -zero-initialize forces IDefaultInitializable on ALL non-core structs (incl. synthesized closures) at slang-check-decl.cpp:11424

Triaging shader-slang/slang#11572 ("-zero-initialize breaks captured lambda construction", HEAD 736e3a242).

**Mechanism (confirmed in code):** the `-zero-initialize` flag's real effect is NOT a per-VarDecl default-init (that's what DeepWiki incorrectly reports for `checkVarDeclCommon`). The actual forcing site is `SemanticsDeclBasesVisitor::visitStructDecl` at `source/slang/slang-check-decl.cpp:11424-11441`: under `getBoolOption(ZeroInitialize) && !isFromCoreModule(decl)` it force-adds an `$inheritance` `InheritanceDecl` with base `IDefaultInitializable` to ANY non-core struct not already conforming. The ONLY filter is `ZeroInitialize && !isFromCoreModule` — there is NO exclusion for synthesized / compiler-generated decls.

**Why that breaks captured lambdas:** a captured lambda is lowered to a synthesized `LambdaDecl` closure struct (`slang-check-expr.cpp:7160`, marked `SynthesizedModifier` at :7162, inherits `IFunc`). It's non-core and has an inheritance entry, so the forcing loop fires on it. Forcing `IDefaultInitializable` collapses its constructor set to a zero-arg `$init()`, so constructing the closure with captured values (`emitCtorInvokeExpr` at :7247, normal overload resolution at :7251) resolves to the 0-param form → `error E39999: too many arguments to call (got 1, expected 0)` / `candidate: _slang_Lambda_..._1.init()`. Repro: any compute shader with `int captured=1; let f=((...)=>...+captured);` compiled with `-zero-initialize` (without the flag it compiles fine).

**Targeted fix:** exclude synthesized closure structs from the force-add at slang-check-decl.cpp:11424 — skip any struct carrying `SynthesizedModifier`, or narrowly `!as<LambdaDecl>(decl)`.

**Two competing UNCONFIRMED deeper micro-mechanisms** (only matter for a general fix; pin with a debug build): (A) the synthesized `IDefaultInitializable` witness ctor is built without `SynthesizedModifier`, so `_hasExplicitConstructor` (slang-check-decl.cpp:11642) treats it as user-defined and suppresses the member-wise ctor (`_synthesizeCtorSignature` bails at :18937); (B) field-forcing (:3346-3350) gives the captured field a forced `initExpr=0`, so `_getParamDefaultValue` (:18907) defaults the member-wise ctor param and `_isDefaultCtor` (:2949) reclassifies it as a default ctor.

**Strategic context:** #11573 "Reimplement -zero-initialize as an IR pass" (also csyonghe) is the long-term redesign that removes all frontend forcing; it names #11572 as the motivating symptom. Keep #11572 scoped to the targeted exclusion — do NOT conflate with #11573. Also note slang-options.cpp:2711 has a stale-looking "zero-initialize is now enabled by default" comment, but the predicate reads getBoolOption which is false unless the flag is passed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781240588042-slang-zero-initialize-forces-idefaultinitializable.md`_
