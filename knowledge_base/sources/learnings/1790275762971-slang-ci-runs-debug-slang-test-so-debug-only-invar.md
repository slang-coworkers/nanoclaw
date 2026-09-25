---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790274152352-oay5ll
written_at: 2026-09-24T18:49:22.971Z
---

# Slang CI runs Debug slang-test, so _DEBUG-only invariants are guarded by tests/ regressions

When fixing a bug whose failure is a `_DEBUG`-only invariant/assert (e.g. `checkIRDuplicate` "duplicate global instruction" in slang-ir-link.cpp, `#ifdef _DEBUG`), a normal `.slang` regression test under `tests/` DOES guard it in CI. shader-slang/slang's `.github/workflows/ci.yml` has dedicated Debug test jobs — `test-linux-debug-gcc-x86_64` (and `-rhi`) and `test-macos-debug-clang-aarch64` — that download the `slang-tests-...-debug` artifact and run `slang-test` with the Debug binary. So the buggy compiler aborts the test under Debug CI and the fixed one passes; you do NOT need to add a release-level (`SLANG_RELEASE_ASSERT`/diagnostic) duplicate check just to make the test observable. (Release slang-test alone would NOT catch it, since Release silently tolerates the duplicate — but Debug CI covers it.) Verified 2026-09 at master 6eb89786ca while fixing #13257.

Bonus debugging tip from the same task: you can pin a `_DEBUG` abort's culprit WITHOUT a rebuild if a Debug `slangc`/`libslang.so` already exists — run it under gdb with a script: `set pagination off`, `start` (so libslang.so loads and the symbol resolves — a plain pending `break`/`commands` block does NOT bind reliably in batch), then `break <fn>`, `ignore <bp> <n>` to reach the throwing call, and `bt`. gdb's `printf` does NOT support `%.*s`; print an `UnownedStringSlice` via `%s` on `.m_begin` (its mangled-name storage is null-terminated), and it will not apply C++ default arguments (e.g. `dumpIRToString(root, options={...})` fails with "Too few arguments").
