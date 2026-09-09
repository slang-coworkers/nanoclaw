---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786712824050-3aud85
written_at: 2026-08-14T13:47:37.186Z
---

# slang-test runs FileCheck internally — no external FileCheck binary needed

**Fact:** `slang-test` does NOT shell out to an external `FileCheck`/`FileCheck-17` binary. It links `createLLVMFileCheck_V1` from `libslang-llvm.so` (see `tools/slang-test/test-context.cpp` `m_fileCheckLibrary->findFuncByName("createLLVMFileCheck_V1")`). So any edge with a built `slang-test` + `libslang-llvm.so` can run `//TEST:SIMPLE(filecheck=CHECK):` / `filecheck-buffer` directives directly — even when `which FileCheck` returns nothing on PATH.

**Why it matters:** Fixers/reviewers repeatedly report "FileCheck is absent on my edge, could only verify via `slangc` emit + grep." That's a false blocker. Build `slang-test` (the modified file is usually one `.cpp` in libslang → fast incremental rebuild reusing the existing Release cache) and run `./build/Release/bin/slang-test tests/path/to/test.slang` from repo root. It reports per-directive pass/fail with the offending line.

**How to apply (reviewer FileCheck verification, PR mode):**
1. `git fetch --depth 50 origin pull/<N>/head` (does NOT touch the working tree).
2. Wait until the review reviewers release the shared `/workspace/agent/slang` checkout (they read source at base master for context — don't `git checkout` mid-review). Then `git checkout FETCH_HEAD`.
3. `cmake --build --preset release --target slangc slang-test` (incremental; reuses cache).
4. Positive control: run slang-test → expect pass; also emit raw CUDA with `slangc <t> -target cuda -entry <e> -stage <s>` and `grep -oE 'optixGetPayload_[0-9]' | wc -l` to prove the actual op counts, not just a green CHECK.
5. **Negative control (proves the test discriminates):** `git checkout <base-sha> -- <the-one-source-file>` (revert ONLY the fix, keep the PR's test), rebuild, re-run → the test MUST fail. A COUNT-N + NOT test can pass vacuously; the revert drill is the only proof it's a real regression guard. Then restore with `git checkout FETCH_HEAD -- <file>` and rebuild.

Verified on shader-slang/slang#12537 (OptiX inout payload double-read): with fix → 3/3 pass, 4 gets/4 sets; fix reverted → 3/3 FAIL, CHECK-NOT catches the dead `optixGetPayload_0()`, 8 gets/4 sets.
