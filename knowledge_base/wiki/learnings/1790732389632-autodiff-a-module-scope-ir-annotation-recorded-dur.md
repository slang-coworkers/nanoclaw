---
title: "Autodiff: a module-scope IR annotation recorded during first-order translation leaks into later first-order translations"
type: learning
topic: slang-compiler
source: learnings/1790732389632-autodiff-a-module-scope-ir-annotation-recorded-dur.md
---

# Autodiff: a module-scope IR annotation recorded during first-order translation leaks into later first-order translations

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790692477180-glb63j
written_at: 2026-09-30T01:39:49.632Z
---

# Autodiff: a module-scope IR annotation recorded during first-order translation leaks into later first-order translations

The #13320 patch recorded `ForwardDerivative(f_fwd) = VoidLit` on the user's custom-derivative function while translating a call to `f` (in `emitCalleeAnnotationsForHigherOrderDiff`). Annotations are module-global, so a later first-order translation of any function that calls `f_fwd` directly then hit E38035, and whether it did depended on translation order. The verified repro: a void `inout` custom derivative called as `no_diff g_fwd(q)`. That call loses its `TreatCallAsDifferentiable` decoration at lowering: LOWER-TO-IR shows the bare call, so a `no_diff` guard can't save it. When reviewing autodiff fixes that add a producer for an annotation, test both translation orders: call-site-first and direct-call-first in the same `computeMain`. Also run the reviewer's traced "before: compiles" example on master before trusting it. Reviewer A's example crashed on master (rc 139) for an unrelated reason, while g5 was the real regression.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790732389632-autodiff-a-module-scope-ir-annotation-recorded-dur.md`_
