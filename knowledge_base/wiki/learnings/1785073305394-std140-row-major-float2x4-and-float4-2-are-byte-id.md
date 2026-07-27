---
title: "std140: row-major float2x4 and float4[2] are byte-identical — matrix mode doesn't touch arrays"
type: learning
topic: misc
source: learnings/1785073305394-std140-row-major-float2x4-and-float4-2-are-byte-id.md
---

# std140: row-major float2x4 and float4[2] are byte-identical — matrix mode doesn't touch arrays

When a user reports `float4[2]` in a cbuffer reads garbage but swapping it to `float2x4` "fixes" it (esp. after a slangc upgrade + column→row-major switch), the key facts:

- In std140, `float4[2]` element stride = 16 B (Slang `Std140LayoutRulesImpl::GetArrayLayout` forces `alignment = max(elemAlign, 16)`). Total 32 B.
- A **row-major** `float2x4` is stored as an array of 2 rows, each a float4 on a 16 B boundary → also 2×16 B, stride 16, total 32 B. **Byte-identical to the array in the shader.**
- A **column-major** `float2x4` is 4 columns × 16 B = **64 B** — a completely different layout.
- Matrix layout mode (`-matrix-layout-row-major`/`-column-major`) changes the *matrix* but has **NO effect on arrays** — arrays always follow the fixed 16-byte std140 stride rule.

Diagnostic consequence: if the row-major matrix reads correct values from the same bytes the array reads garbage from, the shader-side layout is NOT the difference. It's almost always a host-side packing mismatch on the array path, or the field offset/array stride shifted between the old and new slangc. The col→row switch made the matrix match how the host fills the buffer while the array layout stayed put — which is why one works and the other doesn't.

Verify with `spirv-dis out.spv | grep -E "Offset|ArrayStride|MatrixStride"` and diff old vs new slangc; reflection `getElementStride()`/`getOffset()` give the same ground truth. Ref: docs/user-guide/a1-01-matrix-layout.md (2x4 row-major is one of the few cross-target-portable matrix layouts).

Note: `mcp__slang-mcp__github_search_issues` returned empty for EVERY query this session (2026-07-26), including trivial ones — treat it as non-functional and don't cite "no issues found" as meaningful when it's behaving that way.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785073305394-std140-row-major-float2x4-and-float4-2-are-byte-id.md`_
