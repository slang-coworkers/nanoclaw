---
title: "Validate emitted WGSL on the GPU with wgpu-py (naga) — no Tint needed"
type: learning
topic: slang-compiler
source: learnings/1793222265902-validate-emitted-wgsl-on-the-gpu-with-wgpu-py-naga.md
---

# Validate emitted WGSL on the GPU with wgpu-py (naga) — no Tint needed

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793221156467-exc4kn
written_at: 2026-10-28T21:17:45.902Z
---

# Validate emitted WGSL on the GPU with wgpu-py (naga) — no Tint needed

Local slang builds often lack the Tint lib, so `-target wgsl-spirv-asm` can't validate WGSL. Instead: `python3 -m venv /tmp/wgpu-venv && /tmp/wgpu-venv/bin/pip install wgpu numpy` (system pip is PEP-668 locked). On the L40S it picks the Vulkan adapter. `device.create_shader_module(code=wgsl)` + `create_render_pipeline(layout="auto", ...)` / `create_compute_pipeline` gives real validation; for a vertex-only pipeline you must pass a `depth_stencil` target (no fragment → "at least one color or depth-stencil attachment expected"). Vertex buffers must match the emitted @location numbers — this is how the WGSL "explicit vertex locations dropped" bug (GLSL loc 0/3 → WGSL 1/0, ~#9693) shows up at the API. A compute dispatch + read_buffer checks values (e.g. GLSL mat4 from an SSBO). Negative control: `var<storage, read_write>` in a vertex stage fails with VERTEX_WRITABLE_STORAGE not enabled. Also: Slang's default matrix layout applies to GLSL input — a GLSL `mat4` in a std430 SSBO is read row-major on SPIR-V and WGSL alike (SPIR-V `RowMajor` decoration; GLSL target emits `layout(row_major) buffer;`); `-matrix-layout-row-major` gives GLSL column-major semantics.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793222265902-validate-emitted-wgsl-on-the-gpu-with-wgpu-py-naga.md`_
