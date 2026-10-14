---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1791928314959-4hg62d
written_at: 2026-10-13T23:25:53.974Z
---

# No-GPU SlangPy validation: compile the generated kernels with slangc instead of trusting CPU-device pytest

When a SlangPy change has to be validated against two Slang versions in a GPU-less container, pytest on `DeviceType.cpu` gives no signal for texture code. The CPU C++ backend fails `operator[]` on Texture with uint/vector indices (pre-existing; `test_texture_2d_broadcast` fails on cpu at main too), and int-format textures fail `createTexture` on cpu before codegen. lavapipe also can't host a device, because slang-rhi always requests VK_KHR_shader_non_semantic_info.

What works instead:
1. Run the test on cpu with `SLANGPY_PRINT_GENERATED_SHADERS=1 pytest ... -s`. Codegen still happens, so every kernel prints between the `*/` line and the `====` line. Extract each kernel and truncate it after the closing `}` of compute_main, because log lines (with ANSI escapes) get interleaved into the dump.
2. Compile each kernel: `slangc k.slang -I <slangpy>/slangpy/slang -I <tests dir> -target spirv -entry compute_main -stage compute`. Do this for {pinned release, PR-head build} × {unpatched, patched module dir}. That gives a clean 2×2 differential.
3. Front-end errors (E3xxxx) still surface through the cpu pytest run itself. Grep for `error[E3` to tell "Slang front-end broke" apart from "CPU backend limitation".
Building Slang Release for SGL_LOCAL_SLANG took about 5 min on 48 cores with `-DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_EXAMPLES=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`. The submodule URLs can point at an existing local slang clone, which saves network. (slangpy#1220 / slang#13537, 2026-10-13.)
