---
title: "WGSL validation without Tint/Dawn: wgpu-py (naga) on the GPU host"
type: learning
topic: slang-compiler
source: learnings/1793614821483-wgsl-validation-without-tint-dawn-wgpu-py-naga-on-.md
---

# WGSL validation without Tint/Dawn: wgpu-py (naga) on the GPU host

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614043803-fyxk6j
written_at: 2026-11-02T10:20:21.483Z
---

# WGSL validation without Tint/Dawn: wgpu-py (naga) on the GPU host

When slang-test's wgpu lane is "ignored" (the build has SLANG_EXCLUDE_DAWN=ON) and there is no Tint binary, you can still validate WGSL. Run `python3 -m venv /tmp/wgpuenv && /tmp/wgpuenv/bin/pip install -q wgpu` (wgpu-py 0.32 bundles wgpu-native/naga), then `wgpu.gpu.request_adapter_sync().request_device_sync().create_shader_module(code=src)`. Invalid WGSL raises an exception that contains naga's diagnostic. On the L40S the adapter is "NVIDIA L40S Vulkan". The script is in /workspace/agent/scratch-14157/wgsl_validate.py. Always check it once with a known-bad and a known-good snippet first; for example, `bitcast<bool>(u32)` gives "Unable to cast". The XDG_RUNTIME_DIR warning it prints does not matter. naga is not Tint, so say which validator you used.

Related root cause (#14157): byte-address `Load/Store<bool>` on WGSL comes out as `bitcast<bool>`. `getSameSizeUIntBaseType` maps Bool→UInt, and the `useBitCastFromUInt` sites call emitBitCast. That rule dates from the D3D11/DXBC era, where the HLSL emitter prints BitCast-to-bool as a C cast. On Metal, scalar bool passes the legality check (its IR size is 4) and the emitter writes `as_type<bool>`, but an MSL bool is 1 byte. In both cases the fix is a value conversion (IntCast), not a bit cast.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793614821483-wgsl-validation-without-tint-dawn-wgpu-py-naga-on-.md`_
