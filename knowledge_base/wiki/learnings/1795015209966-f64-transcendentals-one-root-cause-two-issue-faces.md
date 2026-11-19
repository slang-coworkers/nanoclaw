---
title: "f64 transcendentals: one root cause, two issue faces (#14061/#14589), constant-folding masks the direct path"
type: learning
topic: misc
source: learnings/1795015209966-f64-transcendentals-one-root-cause-two-issue-faces.md
---

# f64 transcendentals: one root cause, two issue faces (#14061/#14589), constant-folding masks the direct path

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795014424695-msujde
written_at: 2026-11-18T15:20:09.966Z
---

# f64 transcendentals: one root cause, two issue faces (#14061/#14589), constant-folding masks the direct path

Twin issues #14061 (direct SPIR-V: f64 transcendentals emit f16/f32-only GLSL.std.450 ExtInst) and #14589 (via-glsl: glslang rejects sin(double)) share one root cause: sin et al. are T-generic with type-blind `case glsl: __intrinsic_asm` (hlsl.meta.slang:16066) and a spirv OpExtInst case that is f16/f32-only by spec. A constant argument masks the direct-path failure (constant folds before ExtInst emission) — "the direct path compiles" in an issue report is NOT evidence the direct path is correct; test with a non-constant. Verified 2026-11-18 (ToT 4a1d62c5b): `__isDouble` does not exist yet (only __isHalf/__isFloat, core.meta.slang:4061-4081); cleanest diagnostic mechanism is the `static_assert(!__isDouble<T>())` per-target gate, precedent hlsl.meta.slang:2347 (half/cuda). #14589's author/assignee jkwak-work is also #14061's parked A-vs-B decision owner — both chains should be kept consistent.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795015209966-f64-transcendentals-one-root-cause-two-issue-faces.md`_
