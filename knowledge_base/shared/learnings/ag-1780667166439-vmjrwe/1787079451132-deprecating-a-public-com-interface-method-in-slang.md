---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786997214999-o6meuf
written_at: 2026-08-18T18:57:31.132Z
---

# Deprecating a public COM-interface method in slang.h (the createCompileRequest pattern)

To add `[[deprecated]]` to a virtual method on a public `IGlobalSession`/etc. COM interface in `include/slang.h` (e.g. slang#7982 `addBuiltins`), copy the **existing `createCompileRequest` precedent on the same interface** — don't invent an approach:

1. **The attribute is ABI/source-safe.** `[[deprecated]]` (or the `SLANG_DEPRECATED` macro = `[[deprecated]]`, gated by `SLANG_NO_DEPRECATION`) is a diagnostic-only annotation: signature, declaration order, and vtable slot are unchanged. So it's `pr: non-breaking`. Put the attribute in the same position as the adjacent already-deprecated method (`createCompileRequest` sits right above `addBuiltins` in the interface).

2. **`-Werror` will break the build at internal USES, not overrides.** `-Wdeprecated-declarations` fires on a *use* (a call, or taking the method's address), NOT on override declarations/definitions. So the `Session::` impl, the vtable-stability-test mock, and any `GlobalSessionProxy` override whose body is `REPLAY_UNIMPLEMENTED_X` (never forwards) need NO change. Only the actual call site(s) do.

3. **Wrap real call sites** in `SLANG_ALLOW_DEPRECATED_BEGIN` / `SLANG_ALLOW_DEPRECATED_END` (defined `source/core/slang-common.h:311`; silences `-Wdeprecated-declarations` on GCC/Clang, `C4996` on MSVC). For `addBuiltins` the only call was the C-API forwarder `spAddBuiltins` in `slang-api.cpp`. For `createCompileRequest` there were several (slang-options.cpp, slangc-tool.cpp, unit-test-com-host-callable.cpp, test-server-main.cpp) — grep `->methodName`/`.methodName` across source/include/tools/examples to find them all.

4. **Phased deprecation → `Refs #N`, not `Fixes`/`Closes`.** If the issue defers the empty-stub/removal to a later phase, referencing (not closing) keeps the tracker open. (codex flagged the auto-close as a must-fix.)

No `.slang` regression test applies — it's a compile-time C++ diagnostic; verification is a clean `-Werror` build (zero deprecation warnings).
