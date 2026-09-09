---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786482444352-cgdy26
written_at: 2026-08-11T21:23:30.365Z
---

# __magic_type on user struct SIGSEGV — findSyntaxClass non-null fallback defeats the null-guard

shader-slang/slang#12484: applying the internal modifier `__magic_type(Name)` to an ordinary user struct crashes slangc (SIGSEGV, exit 139, no diagnostic) — for BOTH a known-but-unregistered name (`FloatType`) and an unknown one, identically. `__intrinsic_type(1)` on the same struct compiles fine.

ROOT CAUSE (check-time, NOT parse-time; verified @ master cad86b5d3 via Debug-binary assert + source read):
- `parseMagicTypeModifierImpl` (slang-parser.cpp:10598-10603) sets `magicNodeType` via `if (auto sc = astBuilder->findSyntaxClass(name))`. But `findSyntaxClass` (slang-ast-builder.cpp:42-60) returns a NON-NULL `getSyntaxClass<NodeBase>()` FALLBACK on a registry miss — so the guard ALWAYS passes and `magicNodeType` is never left null.
- Consumer `DeclRefType::create` (slang-syntax.cpp:873-896): its `if (!magicMod->magicNodeType) SLANG_UNEXPECTED` guard at :875 is DEFEATED by that non-null fallback. It builds a ValNode whose type is the abstract `NodeBase`.
- `createInstanceImpl` (slang-syntax.cpp:26-34) returns nullptr for an abstract class (no `createFunc`); `_getOrCreateValDirectly` (slang-ast-builder.cpp:425-428) has `SLANG_ASSERT(node)` at :426 which is COMPILED OUT in Release → null-deref at :428 `node->m_operands.add(...)`.

LESSONS:
1. A lookup that returns a NON-NULL sentinel/fallback on a miss silently defeats every downstream `if (!x)` null-guard. When triaging "guard exists but crash still happens", check whether the "missing" value is actually a non-null default. (Same family as DeclRef::as returning non-null for the wrong type.)
2. `SLANG_ASSERT` (debug-only) at a would-be crash site is NOT protection in Release — it's a comment. The Debug binary is a free, deterministic backtrace: exit 255 with `assert failure: file(line): expr` pinpoints exactly what the Release SIGSEGV dereferences. Run the Debug build first before reaching for a debugger (gdb/lldb were absent here).
3. `__magic_type`/`__magic_enum`/`__intrinsic_type`/`__builtin_type`/`__builtin_requirement` are builtin-only internal modifiers assuming a core-module decl. Reject them on non-core-module decls (existing `isFromCoreModule(decl)` predicate, slang-check-decl.cpp:5123) with a real Severity::Error diagnostic — NOT SLANG_UNEXPECTED/Unimplemented (Severity::Internal, wrong "file a GitHub issue" channel). Sibling `__attributeTarget` survives user misuse because its class is only an attribute FILTER, never fed to DeclRefType::create to BUILD a type.
