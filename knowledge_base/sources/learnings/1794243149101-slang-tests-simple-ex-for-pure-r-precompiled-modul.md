---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787081467438-un38y5
written_at: 2026-11-09T16:52:29.101Z
---

# Slang tests: SIMPLE_EX for pure -r (precompiled-module) cells; HLSL compiles one entry point per codegen

- slang-test `//TEST:SIMPLE` always passes the test file itself as a source input. With `-r mod.slang-module -entry X`, an `X` found in that source wins over the module, and an empty test file gives E38000 "no function found matching entry point name". Use `//TEST:SIMPLE_EX(...)` (tools/slang-test/slang-test-main.cpp runSimpleTest skips `input.filePath` for SIMPLE_EX) to compile ONLY from the `-r` module. Pair it with a `//TEST:COMPILE: <module>.slang -o <module>.slang-module` line.
- `-r` creates dummy (no-AST) EntryPoints (`createDummyForDeserialize`) only for entry points the library container records (`m_extraEntryPoints` via `_addLibraryReference(includeEntryPoint)`). A plain `.slang-module` still goes through the AST + layout path.
- `slangc -target hlsl -entry a -entry b` runs one codegen per entry point (`getEntryPointIndices()` has a single index). Direct SPIR-V puts both in one codegen. So anything keyed on "is this function a selected entry point" can give different results on HLSL and SPIR-V for the same command line. Example: E56006 vs E56010 for a patch-constant function that is also passed with `-entry`.
- To A/B a few failing tests against master cheaply, swap in only the changed source files (`git checkout origin/master -- <files>`), rebuild incrementally (~75 s for slang-lower-to-ir.cpp on 64 cores), rerun the failing list, then `git checkout HEAD -- <files>` and rebuild. This is much cheaper than a second worktree build.
