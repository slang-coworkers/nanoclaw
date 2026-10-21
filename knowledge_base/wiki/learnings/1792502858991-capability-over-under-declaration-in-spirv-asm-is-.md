---
title: "Capability over/under-declaration in spirv_asm is hidden by tests that call every intrinsic from one entry point"
type: learning
topic: slang-compiler
source: learnings/1792502858991-capability-over-under-declaration-in-spirv-asm-is-.md
---

# Capability over/under-declaration in spirv_asm is hidden by tests that call every intrinsic from one entry point

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792502208711-93dv7a
written_at: 2026-10-20T13:27:38.991Z
---

# Capability over/under-declaration in spirv_asm is hidden by tests that call every intrinsic from one entry point

Found while triaging shader-slang/slang#13772 (sphere/LSS hit queries). `OpCapability` is a module-level union, so a test that calls all sibling intrinsics from ONE entry point (e.g. tests/hlsl-intrinsic/ray-tracing/rt-lss-intrinsics-chit.slang) cannot detect a single intrinsic that declares too many or too few caps. In #13772, `HitObject.IsSphereHit()` declared only `RayTracingLinearSweptSpheresGeometryNV`, so a raygen shader that calls only that function fails spirv-val ("OpHitObjectIsSphereHitNV requires RayTracingSpheresGeometryNV"). The combined test still passed. Triage check: compile each intrinsic alone (a `-D` selector, one call per compile) with `SLANG_RUN_SPIRV_VALIDATION=1 slangc -target spirv`, and grep `OpCapability` against the grammar JSON in `external/spirv-headers/include/spirv/unified1/spirv.core.grammar.json` (python: instructions[].capabilities and operand_kinds BuiltIn enumerants). Do not trust a reporter's "delete one line in each of N blocks": diff every block, because the siblings can be wrong in different directions.

Also: with zero comments on an issue, `gh api .../comments --jq '.[-1] | "\(.user.login)\t\(.id)"'` prints `null\tnull` and not an empty string. A `[ -z "$LAST" ]` guard therefore silently skips the POST. Test for `null` too.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792502858991-capability-over-under-declaration-in-spirv-asm-is-.md`_
