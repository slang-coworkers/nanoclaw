---
title: "Clip-space Z remap (slang #11599) is NOT DXC parity — unlike invert-y/position-w"
type: learning
topic: slang-compiler
source: learnings/1781333043756-clip-space-z-remap-slang-11599-is-not-dxc-parity-u.md
---

# Clip-space Z remap (slang #11599) is NOT DXC parity — unlike invert-y/position-w

## Context
Triaging slang #11599 (request for `-fvk-remap-z` / `-fgl-remap-z` clip-space depth-range options, "like `-fvk-invert-y`").

## The non-obvious bit
A Z-remap request *looks* like a trivial sibling of `-fvk-invert-y` (#3006), but it is materially different:
- **`-fvk-invert-y` and `-fvk-use-dx-position-w` are DXC-compatibility options** — they exist purely to match DXC behavior. **DXC has NO clip-space-Z remap option**, because D3D, Vulkan, and Metal all share 0..1 NDC depth — there is no Z mismatch among them. So a Z-remap is a **new Slang-specific surface, not a compat shim** → needs explicit maintainer design buy-in, not just a copy-paste of the invert-y pass.
- **Vulkan already uses 0..1 depth.** So `-fvk-remap-z` only matters when the *source shader* was authored for GL (-1..1) conventions. The genuine target-driven mismatch is the **desktop-GL/GLSL** path; even there, modern GL can fix it at the API level via `glClipControl(GL_LOWER_LEFT, GL_ZERO_TO_ONE)`, so the shader-side transform's value depends on the deployment.

## Implementation template (HEAD ac577c6bc), if it ever gets greenlit
Near-clone of invert-y, all pointers verified:
- Parse: `source/slang/slang-options.cpp:869-877`; bool switch `:2630-2631`
- Public ABI enum (append before `CountOf`): `include/slang.h` (invert-y/position-w at `:1021-1022`, CountOf at `:1206`)
- OptionKind→CompilerOptionName: `source/slang/slang-compiler-options.cpp:164-165`
- Transform pass: `source/slang/slang-ir-vk-invert-y.cpp` — model on `invertYOfPositionOutput` (line 24), helper `_invertYOfVector` (10-22). Reuse the existing `IRGLPositionOutputDecoration` (set in `slang-ir-glsl-legalize.cpp:1063-1070`) — no new decoration needed.
- Gate: `source/slang/slang-emit.cpp:2247-2254`, inside `if (isKhronosTarget || target==HLSL)`.
- Math: D3D/Vulkan(0..1)→GL(-1..1) `z'=2z-w`; GL→D3D `z'=(z+w)/2`. Affine, reads BOTH z (idx2) and w (idx3) — unlike invert-y's pure negate of y. Output/STORE side only (VS/DS/GS/mesh write clip-space position).
- **Mesh-shader gap**: invert-y had exactly this bug — #5761 ("-fvk-invert-y doesn't work on Mesh shader position output"). Any Z-remap impl must cover mesh from the start.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781333043756-clip-space-z-remap-slang-11599-is-not-dxc-parity-u.md`_
