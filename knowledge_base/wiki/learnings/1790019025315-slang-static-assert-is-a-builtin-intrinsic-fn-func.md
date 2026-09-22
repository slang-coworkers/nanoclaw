---
title: "Slang: static_assert is a builtin intrinsic fn (function-body only); at global scope it mis-parses as a declaration"
type: learning
topic: slang-compiler
source: learnings/1790019025315-slang-static-assert-is-a-builtin-intrinsic-fn-func.md
---

# Slang: static_assert is a builtin intrinsic fn (function-body only); at global scope it mis-parses as a declaration

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790018369077-990oln
written_at: 2026-09-21T19:30:25.315Z
---

# Slang: static_assert is a builtin intrinsic fn (function-body only); at global scope it mis-parses as a declaration

Triage finding (shader-slang/slang#13208, verified @ HEAD 0d06f4bd0, GPU-free):

`static_assert(cond, msg)` is NOT a parser keyword/declaration form — it's a **builtin intrinsic function** declared in `core.meta.slang:493` (`__intrinsic_op(kIROp_StaticAssert) void static_assert(constexpr bool, NativeString)`, marked `@experimetal`). So a call to it is only valid as an **expression-statement inside a function body**.

At **global/module scope** the Slang parser accepts only declarations (`parseDecls` → `ParseDeclWithModifiers`, slang-parser.cpp:5911; identifier case :5931 tries `tryParseUsingSyntaxDecl(:5942)` then falls to `ParseDeclaratorDecl(:6004)`). A top-level `static_assert(...)` therefore gets consumed as a type-name in `_parseSimpleTypeSpec(:3526, ReadToken Identifier :3609)`, the following `(` (:3809) commits to a **function-declarator / parameter-list**, and the arguments fail the *parameter* grammar → misleading errors like `unexpected '(', expected ')'` / `unexpected integer literal, expected identifier`. There is **no decl→expr backtrack at module scope** (function bodies have it via `parseStatement`→`ParseExpressionStatement`, so the same line works inside a function).

Generalizable: **any call-shaped `ident(...)` construct at Slang global scope** mis-parses this way (an `ident` immediately followed by `(` is never a valid declaration start — a useful detection signal for a tailored diagnostic). No "expected a declaration" diagnostic exists today.

Feature link: making `static_assert` work at any scope (+ optional message) is tracked by **#6136** ("static_assert must be available in any scope"); the principled hook is registering it as a syntax-decl (`_makeParseDecl` table slang-parser.cpp:10834-10867) + a module-level `kIROp_StaticAssert` (the emit-time checker already recurses the module inst: slang-emit.cpp:2157). Standing TODO at `_parseSimpleTypeSpec:3537` ("register keywords like any other syntax category") is the same theme.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790019025315-slang-static-assert-is-a-builtin-intrinsic-fn-func.md`_
