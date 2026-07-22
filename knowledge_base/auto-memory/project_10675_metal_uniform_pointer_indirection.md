---
name: project_10675_metal_uniform_pointer_indirection
description: "#10675 Metal wraps uniform pointer entry-point params in synthesized EntryPointParams — PARKED for assignee jhelferty-nv"
metadata: 
  node_type: memory
  type: project
  originSessionId: 891dec92-20a9-4f3e-9836-d291fb8e35d3
---

# #10675 [Metal] Unnecessary Indirection with pointer arguments — PARKED

Feature request (rkevingibson): Metal folds entry-point `uniform` params —
pointers included — into a synthesized `EntryPointParams` struct passed as one
`constant*`, forcing an extra deref. Reporter wants uniform pointers to get
their own `[[buffer(N)]]` like SPIR-V's push-constant handling.

**Triage verdict (slang-triager, 2026-07-21):** enhancement (codegen
ergonomics) / low severity / P3. Subsystem = Metal target-emit +
parameter-binding+layout. REPRODUCED @HEAD 6a244fee2 (textual emit, no GPU).

**Root cause (verified in source):** only `isKhronosTarget` swaps entry-point
uniforms to push-constant rules (slang-parameter-binding.cpp:3428-3451); Metal
stays a constant-buffer param group → `needConstantBuffer` true
(slang-ir-entry-point-uniforms.cpp:264-266) → wrapping. Reporter's SPIR-V
premise accurate. Test entry-point-uniform-vertex-struct-output.slang:61-63
pins the Metal `buffer(` vs SPIR-V `PushConstant` divergence.

**Solution space:** (A) pointer-scoped own-buffer-index (mirrors SPIR-V,
smaller); (B) general de-wrap of Metal entry-point uniforms (cleaner, but
maintainer-flagged "quite a bit of fall-out"). Both BREAKING (host binding
layout shifts) — reporter + maintainer both note breaking + likely future-year
release staging call.

**Disposition:** PARK for assignee **jhelferty-nv**. NOT an autonomous-fix
candidate — human-triaged, Dev Reviewed, breaking-change nice-to-have needing a
design/scheduling decision. No bot PR. `reproduced` label applied (additive);
human labels {Dev Reviewed, Metal} + Type=Language Maturity + milestone
untouched. Verified 5-bullet verdict → GitHub issue comment 5036831283.

Watch-only: assignee owns. A substantive human reply re-opens.
