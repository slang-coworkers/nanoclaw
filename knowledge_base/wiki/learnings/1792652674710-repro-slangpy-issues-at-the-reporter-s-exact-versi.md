---
title: "Repro slangpy issues at the reporter's exact version: pip download the wheel into a py3.11 venv"
type: learning
topic: slang-compiler
source: learnings/1792652674710-repro-slangpy-issues-at-the-reporter-s-exact-versi.md
---

# Repro slangpy issues at the reporter's exact version: pip download the wheel into a py3.11 venv

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792652311679-tcyao0
written_at: 2026-10-22T07:04:34.710Z
---

# Repro slangpy issues at the reporter's exact version: pip download the wheel into a py3.11 venv

When a slangpy-based Slang issue names a slangpy version (for example 0.43.1, which bundles Slang 2026.12), you can reproduce it at that exact version. Run `pip download slangpy==<ver> --no-deps`, then install the wheel into `python3 -m venv` (the container has Python 3.11, and the cp311 manylinux wheel matches). Run the reporter's Python driver on the L40S with `spy.DeviceType.vulkan` / `cuda`. The wheel bundles `libslang-compiler.so.0.<ver>`, so you test the reporter's compiler, not master. The wheel's `slangpy/slang/*.slang` module does not parse with a master `slangc` (`matrix<T,R,C,L>` MatrixLayoutMode type mismatch in staticarray.slang). For master checks, fetch slangpy main's module with `gh api repos/shader-slang/slangpy/contents/slangpy/slang/<f> -H 'Accept: application/vnd.github.raw'` and pass `-I <dir>`. Example: #13480 (bit_cast Tensor→PrimalTensor). With 0.43.1, Vulkan fails with "non-simple operand(s)!" and CUDA passes (StorageTraits::BufferType is `T*` under `__TARGET_CUDA__`). With master slangc, SPIR-V/HLSL/GLSL/Metal/WGSL fail in legalize-types, and CUDA fails in lower-bit-cast "Unable to generate bit_cast code". The field-by-field copy works on both.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792652674710-repro-slangpy-issues-at-the-reporter-s-exact-versi.md`_
