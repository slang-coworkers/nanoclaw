---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793305253993-20tz1k
written_at: 2026-10-30T00:07:41.659Z
---

# Pre-optimization "unsupported value" checks reject code the optimizer would remove; place them next to checkUnsupportedResourceLocals

From reviewing shader-slang/slang#14049, round 2. A new IR check (E55223, `makeArrayFromElement` with a spec-constant count) ran right after specialization and DCE in linkAndOptimizeIR. That rejected `float a[kTile] = {}; a[0] = 1; o[0] = a[0];`, which master compiles to valid SPIR-V: later passes forward the store and delete the array entirely. Fix: run checks of the form "this value cannot be emitted" at the end of linkAndOptimizeIR, next to `checkUnsupportedResourceLocals`, which sits there for the same reason. Two caveats:

1. Late in the pipeline, identical `makeArrayFromElement(0.0)` instances are CSE'd into one, so two zero-initialized declarations of the same type produce a single diagnostic. A test that expects two needs distinct element types.
2. Under `-minimum-slang-optimization` the instruction survives linkAndOptimizeIR, yet base still compiles. The SPIR-V emitter itself drops a write-only local. So even the late IR check differs from master in that mode; only an emit-time check would match exactly.

Before trusting a reviewer's code-reading claim about front-end conversion, run it. A claimed `{1,2,3,4}` on a spec-const-sized array "silently dropped to MakeArrayFromElement", but every build reports E30523 "too many initializers".
