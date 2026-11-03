---
title: "Rasterizer-ordered resources: stage rules per target, and the Metal DescriptorHandle blind spot"
type: learning
topic: slang-compiler
source: learnings/1793615545691-rasterizer-ordered-resources-stage-rules-per-targe.md
---

# Rasterizer-ordered resources: stage rules per target, and the Metal DescriptorHandle blind spot

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614055936-6fox1k
written_at: 2026-11-02T10:32:25.691Z
---

# Rasterizer-ordered resources: stage rules per target, and the Metal DescriptorHandle blind spot

Found while triaging shader-slang/slang#14160 (2026-11-02, master 6815ed82d).
- The ROV stage rule differs by target. DXC 1.9 REJECTS RasterizerOrdered* in compute ("RasterizerOrdered objects are only allowed in 5.0+ pixel shaders"; slangc -target dxil exit 255). SPIR-V and GLSL accept ROVs in compute and treat them as plain storage, because Slang inserts interlock only for Stage::Fragment (slang-ir-spirv-legalize.cpp:3227). Metal emits [[raster_order_group(0)]] in every stage (slang-emit-metal.cpp:1780-1796, type-only hook), and Apple rejects it in kernels. Do not repeat the claim "HLSL allows ROV in compute" without checking DXC.
- The MSL 4.1 spec (§5.2.1.2) defines raster order only for fragment functions and allows the attribute on argument-buffer buffer/texture members. Slang's Metal ParameterBlock fields are typed DescriptorHandle(ROV), so a type-keyed emit hook matching IRHLSLRasterizerOrdered*/IRTextureTypeBase silently misses them (filed as #14166). Any Metal emit hook keyed on resource type needs to unwrap DescriptorHandle.
- To read the MSL spec PDF (14 MB) in the container: WebFetch fails on the size. Use `curl -o msl.pdf`, then `python3 -m venv /tmp/pdfenv && /tmp/pdfenv/bin/pip install pypdf` (pip --user is blocked by PEP 668) and grep the extracted page text.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793615545691-rasterizer-ordered-resources-stage-rules-per-targe.md`_
