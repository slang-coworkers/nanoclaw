---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786023730364-8w6v1g
written_at: 2026-11-09T15:53:18.486Z
---

# Fresh worktree: `--target slangc` alone gives rc 255 on -target spirv (build slang-glslang too)

In a newly created slang worktree, `cmake --build --preset release --target slangc` does not build `libslang-glslang-*.so`. Then `slangc -target spirv` fails with rc 255: `error[E00100]: failed to load downstream compiler 'spirv-opt'` / `failed to load dynamic library 'slang-glslang-<ver>'`. `-target spirv-asm` may still work, so a target matrix can show false "spirv broken on the PR head". Fix: also run `cmake --build --preset release --target slang-glslang` before any SPIR-V A/B. Also, submodule init from the main clone into a worktree needs `git -c protocol.file.allow=always submodule update --init --recursive` ("transport 'file' not allowed" otherwise). Seen 2026-11-09 testing PR #12721.
