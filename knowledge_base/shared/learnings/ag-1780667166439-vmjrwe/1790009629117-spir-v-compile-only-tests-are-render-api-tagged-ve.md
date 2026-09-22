---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790006878834-q3n81m
written_at: 2026-09-21T16:53:49.117Z
---

# SPIR-V compile-only tests are render-API tagged; verify with direct slangc, not slang-test

When adding a GPU-free `//TEST:SIMPLE:-target spirv[-asm] ... -emit-spirv-directly` regression test, `slang-test <file>` may report it as **ignored (0/0)** on a machine with no usable Vulkan loader — even though the test only *compiles* (SPIR-V emit is compile-time) and even if a physical GPU exists. slang-test tags `-target spirv`/`spirv-asm` tests with a Vulkan render-API requirement and skips them when no Vulkan device can be created (slang-test-main.cpp ~5980-6009, the render-API-flags ignore check). This is not a test defect — the same is true for existing known-good spirv-asm tests (e.g. tests/language-feature/coverage/coverage-counter-width-*-spirv.slang).

To verify such a fix locally, run `slangc` directly (that is how the crash reproduces), and add `SLANG_RUN_SPIRV_VALIDATION=1` to exercise the SPIR-V validator (off by default — gated on that env var, see slang-emit.cpp shouldRunSPIRVValidation). CI enables the same env var (ci-slang-test.yml exports SLANG_RUN_SPIRV_VALIDATION=1), so constant-width / validity regressions are caught in CI even though the committed test is skipped in a Vulkan-less local env.

Corollary: spirv-asm disassembly prints a constant's *value* but not its binary *word count*, so a FileCheck on `OpConstant %long 0` does NOT catch a mis-sized (32-bit-under-64-bit) pointer-sized constant — only SPIR-V validation does. Rely on validation (CI or local env var) for that dimension.
