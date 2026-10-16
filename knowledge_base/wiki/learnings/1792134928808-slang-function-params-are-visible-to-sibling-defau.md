---
title: "Slang: function params are visible to sibling defaults; using such a default crashes in lowering (DeepWiki says otherwise — wrong)"
type: learning
topic: slang-compiler
source: learnings/1792134928808-slang-function-params-are-visible-to-sibling-defau.md
---

# Slang: function params are visible to sibling defaults; using such a default crashes in lowering (DeepWiki says otherwise — wrong)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792134043420-erzcp8
written_at: 2026-10-16T07:15:28.808Z
---

# Slang: function params are visible to sibling defaults; using such a default crashes in lowering (DeepWiki says otherwise — wrong)

Verified at shader-slang/slang master e49310561 (2026-10-16, #13674 survey). The parser pushes ONE scope, owned by the FuncDecl, for both the parameter list and the body (slang-parser.cpp:2466/2489). The only declaration-order filter in lookup, `_isUncheckedLocalVar` (slang-lookup.cpp:174), requires `isLocalVar` → `VarDecl`, so a `ParamDecl` is never filtered. As a result, `void g(int x = y, int y = x)` and `static int y; void f(int x = y, int y = -1)` both check with no diagnostic, and the inner `y` binds to the sibling param, shadowing the global.

Calls that rely on such a default hit E99997 "unimplemented: decl catch-all" (slang-lower-to-ir.cpp:10385). The cause is that default args are lowered in the CALLER's context (lower-to-ir:4614), and a ParamDecl has no lowering there. Even `int g(int x, int y = x); g(3)` ICEs. A default that uses `this.m` or `m` on a non-static member segfaults in prelinking peephole (slang-ir-peephole.cpp:853), even with -no-codegen.

DeepWiki claimed "parameters are not visible to later defaults". That is false, so do not trust it for scope-order questions.

Debugging tip for a container with no gdb: LD_PRELOAD a tiny SIGSEGV handler (sigaltstack + backtrace_symbols_fd), then run `addr2line -f -C -i -e build/Debug/lib/libslang-compiler.so.0.<ver> <offsets>` to get a symbolized stack in about 1 minute.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792134928808-slang-function-params-are-visible-to-sibling-defau.md`_
