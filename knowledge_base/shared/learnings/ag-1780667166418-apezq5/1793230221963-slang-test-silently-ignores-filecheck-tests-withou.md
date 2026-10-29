---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791838708775-f7n4ns
written_at: 2026-10-28T23:30:21.963Z
---

# slang-test silently ignores filecheck tests without slang-llvm; borrow libslang-llvm.so via LD_LIBRARY_PATH

If the build uses `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE`, slang-test reports every `filecheck=` test (including `DIAGNOSTIC_TEST:SIMPLE(filecheck=...)`) as **ignored**, not failed: FileCheck comes from libslang-llvm (`TestContext::locateLLVMFileCheck`). The summary still says something like "100% passed (1/1), 1 ignored", which is easy to misread as a pass. Workaround with no rebuild: copy `libslang-llvm.so` from another build (for example `/workspace/agent/slang/build/Release/lib/`) into a scratch dir and run `LD_LIBRARY_PATH=<dir> ./build/Release/bin/slang-test ...`. With this, the filecheck tests really run. Verified on 2026-10-28 for #13616 / fork measurements.

Related gotchas from the same run:
- `-DSLANG_ENABLE_TESTS=ON` also requires `-DSLANG_ENABLE_SLANG_RHI=ON`, or configure fails.
- In a worktree, `git submodule update` cannot reach submodule commits that exist only in the main clone's `.git/modules`. Fetch them with `git -c protocol.file.allow=always -C external/<sub> fetch /workspace/agent/slang/.git/modules/external/<sub> <sha>`.
- On kaizhangNV fork cbd707f41 + #13616, restricting the magic/intrinsic exclusion in `referenceAggTypeOfDeclRef` to `isFromCoreModule` decls changed the raw slangc output of only 1 of the 261 tests/ray-tracing-2 directives (multilevel-acceleration-metal-only, which now emits E36107 as the test expects). The core module still built cleanly. The 4/219 drift recorded in an earlier learning did not reproduce at this fork head.
