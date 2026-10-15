---
title: "Verify a slangpy companion PR against an unmerged Slang PR's compiler locally (no GPU)"
type: learning
topic: slang-compiler
source: learnings/1791935481120-verify-a-slangpy-companion-pr-against-an-unmerged-.md
---

# Verify a slangpy companion PR against an unmerged Slang PR's compiler locally (no GPU)

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1791933876239-y0ikuf
written_at: 2026-10-13T23:51:21.120Z
---

# Verify a slangpy companion PR against an unmerged Slang PR's compiler locally (no GPU)

When reviewing a SlangPy PR that pre-adapts `slangpy/slang/*.slang` to a pending Slang PR, you can check "breaks unpatched, works patched" yourself without a GPU:

1. Shallow-fetch the Slang PR head SHA, then build only `slangc`:
   `cmake --preset default -DSLANG_SLANG_LLVM_FLAVOR=DISABLE -DSLANG_ENABLE_DXIL=OFF -DSLANG_DXC_BUILD_FROM_SOURCE=OFF -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_EXAMPLES=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF`, then `cmake --build --preset release --target slangc slang-glslang -j48`. This takes about 10 minutes on 64 cores.
   - On a container with GLIBC < 2.38, leaving DXIL on makes FetchDXC build DXC from source, which costs 500 MB and 10-30 minutes.
   - Without the `slang-glslang` target, SPIR-V output fails with E00100 "failed to load downstream compiler 'spirv-opt'".
2. Write a small harness: `import slangpy;` plus a compute entry point taking `uniform Texture2DType<vector<int,1>>`-style params, calling `__slangpy_load`/`__slangpy_store`. Compile it with `-I <checkout>/slangpy/slang` for each of spirv/hlsl/cuda/metal, against both the old checkout and the PR checkout. Capture `$?` immediately: a `$(git rev-parse)` inside the echo clobbers it.
3. Diff `-target spirv-asm` output from the pinned compiler, patched vs unpatched. If it is identical, the change is a provable no-op on the current Slang.
4. For the GPU signal, tally the new test from PR CI. `gh run view <id> --log` gives tab-separated job/step/line; grep for the test name and PASSED|SKIPPED, and group by job and `DeviceType`. Linux CI runs vulkan+cuda, Windows runs d3d12+vulkan+cuda, and macOS runs metal.
5. The Slang PR's downstream "SlangPy Tests" run (slangpy ci-latest-slang, `build-pr`) tests slangpy `main` unless `SLANGPY_CHERRY_PICK_PR` is set. Its unique `core.slang:<line>` error locations are the exact set the companion PR must fix.
6. To run the combined pair on a GPU before merging, run `gh workflow run ci-latest-slang.yml --ref <slangpy-branch> -f slang_branch=<slang PR branch>`. This works only for PR branches inside shader-slang/slang, because branch mode hard-codes that repo.

Seen on slangpy#1220 / slang#13537 (2026-10-13).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791935481120-verify-a-slangpy-companion-pr-against-an-unmerged-.md`_
