---
title: "slang#8125 empty-struct fix — global field-removal pass is CI-rejected, fix belongs in empty-type legalization"
type: learning
topic: slang-compiler
source: learnings/1783473465864-slang-8125-empty-struct-fix-global-field-removal-p.md
---

# slang#8125 empty-struct fix — global field-removal pass is CI-rejected, fix belongs in empty-type legalization

## Context
shader-slang/slang#8125: an empty `struct` used as a **member** inside a public/layout-decorated struct (e.g. a `ParameterBlock<CallData>` element) crashes on CUDA (`CUDA_ERROR_ILLEGAL_ADDRESS`) / CPU (SIGSEGV). Root cause: `IREmptyTypeLegalizationContext::isSimpleType` (`source/slang/slang-ir-legalize-types.cpp:4058`) deliberately RETAINS an empty type that carries `LayoutDecoration`/`PublicDecoration`/`ExternCpp`/`Dll*`/`HLSLExport`/`BinaryInterfaceType`. On C/C++/CUDA *source* targets that retained empty member emits as a real 1-byte C++ member, but type-layout gives it size 0 and skips it (`slang-type-layout.cpp:339/577`; the `:4894` warning explicitly says final-decl generation "needs to *also* eliminate zero-size fields"). → reflection puts the next field at offset 0, emitted struct puts it 1 byte later → host/device offset mismatch. Direct-LLVM CPU path is fine (empty struct = zero-size LLVM type).

## The trap (learned the expensive way)
The "obvious" fix — a focused IR pass that removes empty-struct fields on the C-like emit path and rewrites all uses (FieldExtract/FieldAddress/MakeStruct) — was implemented as PR **#11657** (`removeEmptyStructFields`, gated `!isCPUTargetViaLLVM`). **CI rejected it and jkwak-work closed it.** A *global* empty-field removal also strips the zero-size empty fields that `Conditional<T,false>`/`Optional` rely on in dynamic-dispatch AnyValue/existential payloads → `tests/language-feature/dynamic-dispatch/layout-conditional-field.slang.4 (cpu)` aborts with `non-simple operand(s)!` (`slang-ir-legalize-types.cpp:2191`). Those zero-size empties are load-bearing for type legalization.

## Correct direction (jkwak's steer)
Confine the fix to the **existing empty-type legalization layer** (`IREmptyTypeLegalizationContext`), reconciling the retained-public empty *member* with the reflected size-0 layout on C-source targets, WITHOUT touching the non-member / interface empties that dynamic dispatch needs. `layout-conditional-field.slang` (all 4 specializations) is the discriminating regression guard — it MUST stay green. A 5-shape CPU+CUDA regression test is preserved on branch `origin/fix/issue-8125` @ `3e2492d7fa`: `tests/bugs/empty-struct-parameter-block.slang` (reported ParameterBlock crash + by-value FieldExtract + initializer-list MakeStruct + inout FieldAddress + middle-field). `removeEmptyStructFields` is NOT in master (never merged).

## Takeaway
When a fix removes/rewrites "empty struct" fields in Slang IR, it is NOT safe to do globally — empty structs double as the zero-size payload members of `Conditional`/`Optional` in dynamic-dispatch legalization. Scope any empty-struct-field change to the reflected-layout-bearing structs (public/layout-decorated) via the legalization that already owns empty-type handling, not a blanket downstream pass. Same family as #7612 ("Properly handle empty CUDA structs").

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783473465864-slang-8125-empty-struct-fix-global-field-removal-p.md`_
