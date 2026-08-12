# CUDA gather $T0 vs $TR marker + local GPU/NVRTC/FileCheck are present

## Fixing CUDA/PTX texture-intrinsic result-type bugs (slang#12276)

**The `$T0` vs `$TR` intrinsic-expand marker** (`source/slang/slang-intrinsic-expand.cpp`, `_emitSpecial()` case `'T'`, ~lines 405-428):
- `$Tn` → argument *n*'s type; **for a texture argument it unwraps to the element type** via `getElementType()`.
- `$TR` → `m_callInst->getDataType()` = the **call's return type**.

When a CUDA texture intrinsic's result type differs from the texture element type (e.g. `Gather` returns `vector<T.Element,4>` but the texture is `Texture2D<float>`), the intrinsic string must use `$TR`, not `$T0`. slang#12276: `tex2Dgather<$T0>` emitted `tex2Dgather<float>` (scalar) assigned into a `float4` → NVRTC "no suitable constructor to convert from float to float4". One-token fix `$T0`→`$TR` at `hlsl.meta.slang` (both CUDA `Gather` sites, no-offset + offset overload). Precedent: `bitcast $0 to $TR`. This generalizes: any `Gather`/`GatherRed/Green/Blue/Alpha` or similar CUDA texture op whose signature returns a vector wider than the element type has the same latent bug.

**Environment surprise — the prod slang-fixer container HAS a GPU + NVRTC + FileCheck**, despite CLAUDE.md/copilot-instructions saying "no GPU, can't run GPU tests":
- `nvidia-smi` → NVIDIA L40S; `/usr/local/cuda-12.6/.../libnvrtc.so.12` present.
- Therefore `//TEST:SIMPLE(filecheck=...): -target ptx` is a **real end-to-end NVRTC compile-check** locally (not skipped) — the strongest regression signal for CUDA codegen bugs. Existing repo precedents: `tests/optimization/buffer-load-defer-user-pointer.slang`, `tests/cuda/optix-ser.slang`.
- FileCheck IS installed here → `filecheck=`/SIMPLE tests actually run and fail properly (the older "FileCheck usually absent → SIMPLE tests silently ignored" note does NOT hold in this container; verify with a quick `slang-test <one test>` before assuming ignore-vs-fail).
- `-target cuda` runs `slangc` and can also invoke NVRTC on the generated C++ if the test compiles it; `nvidia-smi` before punting any repro to "hardware-gated".

**FileCheck comment hazard:** a prose comment line that starts with a check-prefix token (e.g. `// PTX: exercises the compile...`) is parsed by FileCheck as a `PTX:` directive and fails. Keep the prefix token out of the leading position of non-directive prose in test files.
