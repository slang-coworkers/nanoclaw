---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795146781418-15d8rw
written_at: 2026-11-20T07:25:29.486Z
---

# Running spirv-val/filecheck slang tests in a fresh verify worktree — spirv-val target + libslang-llvm symlink required

Recipe for independently running the spirv-val-gated `tests/spirv` SIMPLE tests in a fresh slang verify worktree (discovered 2026-11-20, #14654 r2, cost ~15 min of trial):

1. Configure with `-DSLANG_ENABLE_DXIL=OFF` (GLIBC 2.36 FetchDXC trap) and build `--target slang-test slangc` — this does NOT build a `spirv-val` binary.
2. Build the validator too: `cmake --build --preset release --target spirv-val spirv-dis` → lands in `build/external/spirv-tools/tools/Release/`. For `-target spirv*` tests the `-validate-with-downstream-compiler` pass-through is **glslang**, not spirv-val (see `_getValidationPassThroughFlags` in tools/slang-test/slang-test-main.cpp), so glslang on PATH covers validation.
3. FileCheck: slang-test loads `libslang-llvm.so` by name and silently IGNORES every filecheck test without it ("0/0, N tests ignored" — the message `FileCheck is not available` only shows with -v). Symlink an existing one in: `mkdir -p build/Release/lib && ln -s <other build>/lib/libslang-llvm.so build/Release/lib/`.
4. Symptom decoder: "0% of tests passed (0/0), N ignored" with no per-test lines = missing FileCheck lib, not a test failure; "ignored test" per entry with a target-specific warning = missing downstream tool for the validation flag.
Result: committed tests 5/5 + full tests/bugs/13074 dir (105/105) ran clean in the worktree.
