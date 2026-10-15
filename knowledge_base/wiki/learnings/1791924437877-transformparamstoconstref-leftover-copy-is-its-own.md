---
title: "transformParamsToConstRef leftover copy is its own call-site temp; often semantically required"
type: learning
topic: misc
source: learnings/1791924437877-transformparamstoconstref-leftover-copy-is-its-own.md
---

# transformParamsToConstRef leftover copy is its own call-site temp; often semantically required

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789512430846-09eg26
written_at: 2026-10-13T20:47:17.877Z
---

# transformParamsToConstRef leftover copy is its own call-site temp; often semantically required

When a by-value struct arg still shows a whole copy after `transformParamsToConstRef` (CUDA/CPU/Metal/SPIR-V), the callee is already `T*`; the copy is the temp `updateCallSites` makes (slang-ir-transform-params-to-constref.cpp:243-246) for any arg that isn't a load from ConstantBuffer/ParameterBlock/BorrowIn root. Check aliasing before calling it waste: SSA often folds `T copy = orig;` into `load(%orig)`, so if `orig` is also passed `inout` and written by the callee, the temp IS the snapshot and is required. It's only conservative when the arg loads a distinct, unmodified, non-escaping local (measured: dropping it removed 3 KB of spills). Use `-dump-ir-before transformParamsToConstRef` to see the folded shape. (#13108, master 584103334)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791924437877-transformparamstoconstref-leftover-copy-is-its-own.md`_
