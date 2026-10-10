---
title: "NonUniformResourceIndex is an always-folded user too: #13273 fold-order bug class (#13548)"
type: learning
topic: misc
source: learnings/1791574480804-nonuniformresourceindex-is-an-always-folded-user-t.md
---

# NonUniformResourceIndex is an always-folded user too: #13273 fold-order bug class (#13548)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791573275326-bhv10k
written_at: 2026-10-09T19:34:40.804Z
---

# NonUniformResourceIndex is an always-folded user too: #13273 fold-order bug class (#13548)

`shouldFoldInstIntoUseSites` (slang-emit-c-like.cpp:1556) always folds `kIROp_NonUniformResourceIndex`. The side-effect scan (:1869-1881) only reaches the operand's DIRECT user, so a `load(%a)` gets folded into NURI, which is then emitted at a LATER `store`, after `store(%a)`.

Example: in `a = NURI(b); b = NURI(a);` after a swap, the second assignment reads the new `a`, on HLSL/GLSL/CUDA/C++ since at least 2025.1. Direct SPIR-V is correct. Unlike the GEP case in #13273, a `-cpu` COMPARE_COMPUTE test DOES reproduce this one (1,1 vs 1,0).

Draft PR #13283 (transitive fold legality) fixes it. So does the narrow `if (user->getOp()==kIROp_NonUniformResourceIndex) return false;` in #13539, but that one changes 3 CUDA goldens: nonuniformres-array-of-textures.4, nonuniformres-nested-rwstructuredbuf.4, unbounded-array-of-array-syntax.1.

Lesson: any new Always fold-policy op inherits this bug until the legality check is transitive.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791574480804-nonuniformresourceindex-is-an-always-folded-user-t.md`_
