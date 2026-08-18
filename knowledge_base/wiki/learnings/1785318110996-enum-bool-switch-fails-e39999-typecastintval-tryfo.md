---
title: "enum:bool switch fails E39999 — TypeCastIntVal::tryFoldImpl lacks BaseType::Bool case"
type: learning
topic: misc
source: learnings/1785318110996-enum-bool-switch-fails-e39999-typecastintval-tryfo.md
---

# enum:bool switch fails E39999 — TypeCastIntVal::tryFoldImpl lacks BaseType::Bool case

**Symptom:** `switch` on `enum E : bool` → `error[E39999]: could not extract value from integer constant` at every `case`, target-independent (spirv/hlsl/cpp), front-end. (shader-slang/slang#12260, verified @HEAD 6dba5d212.)

**Root cause:** `TypeCastIntVal::tryFoldImpl` (`source/slang/slang-ast-val.cpp:~2107`) folds an enum case by casting the tag `ConstantIntVal` to the enum's tag type. Its inner `convertValue` lambda `switch(baseType->getBaseType())` handles Int/UInt/Int64/Int16/Int8/… but has **NO `BaseType::Bool` case** → `default: return false` → `tryFoldImpl` returns `nullptr`. The enum-case fold at `slang-check-expr.cpp:3203-3204` (`getTypeCastIntVal(enumCaseDecl->getType(), intVal)->resolve()`) then leaves an *unfolded* `TypeCastIntVal`. Consumer `checkConstantIntVal` (`slang-check-modifier.cpp:40-43`, reached from `visitCaseStmt` in `slang-check-stmt.cpp:430`) does `as<ConstantIntVal>` on it, fails, and emits E39999.

**Why it's a real bug not a "reject it":** `enum : bool` is a supported, tested feature (`tests/language-feature/interfaces/enum-bool-lowering.slang`, `tests/bugs/11043-enum-constant-wraparound.slang`); `validateEnumTagType` accepts bool; `enum : int` switch works; `static_assert` on the same bool-enum cases folds fine. Only the switch-case value extraction path is broken.

**Fix (producer-side, one line):** add `case BaseType::Bool: resultValue = resultValue & 1; return true;` to the `convertValue` lambda. **`& 1` bit-truncation is load-bearing** — `tests/bugs/11043` asserts bool-tag wraparound as `& 1` (implicit `Value2 = 2` → asserted `!Value2` false; `Value3 = 3` → true). A C++ `(bool)` cast (`(bool)2 == true`) would be WRONG and would regress 11043. Fixing the producer makes downstream consumers (duplicate-check `HashSet<Val*>`, IR `IRSwitch`/`IRIntValue` lowering) get the canonical `ConstantIntVal` they already expect — no consumer-side patch needed.

**Distinct from #12237/#12254:** plain `bool` switch (`switch(b){case true:…}`) fails LATER with `E99997 Unhandled type passed to getIntTypeWidth` in SPIR-V legalize (the #12237 path, fixed by #12254). `enum:bool` fails EARLIER in the front-end checker. Different error, different stage.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785318110996-enum-bool-switch-fails-e39999-typecastintval-tryfo.md`_
