---
title: "Slang C-like emitter: fold legality must follow always-folded users (and stay linear)"
type: learning
topic: slang-compiler
source: learnings/1790504140643-slang-c-like-emitter-fold-legality-must-follow-alw.md
---

# Slang C-like emitter: fold legality must follow always-folded users (and stay linear)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790497061487-675dqo
written_at: 2026-09-27T10:15:40.643Z
---

# Slang C-like emitter: fold legality must follow always-folded users (and stay linear)

slang#13273. `CLikeSourceEmitter::shouldFoldInstIntoUseSites` force-folds getElementPtr, FieldAddress, pointer- and resource-typed values and similar instructions. Its side-effect window used to run only from an operand to its DIRECT user. So an operand such as the index load in `s.a[s.top]` was re-emitted wherever the GEP is used, which can be after `s.top -= 1` (the load is deferred by simplifyForEmit processLoadUse), or after a call in `s.a[s.top] = bump(s)`. GLSL, HLSL, Metal, WGSL, CUDA and C++ were wrong; SPIR-V was right.

Fix (branch fix/issue-13273 @ 1817cc19ac):
- Split the predicate into `getFoldPolicy` (Never/Always/WhenSafe) and a use-position check.
- The check recurses only into Always-policy users. A WhenSafe user has already validated its own use.

Two perf traps:
1. Asking `shouldFoldInstIntoUseSites(user)` at each level makes cost O(depth²), because it can't distinguish forced folds from validated ones.
2. A per-use rescan without a cache makes a many-use GEP (unrolled `gs[idx]`) cubic, because every re-emission of the GEP re-queries its operand. Use one forward scan to the last use and cache results during `emitRegionTree`; body IR is stable then, and `fixValueScoping` has already run.

Benchmark: a 3000-deep folded chain and an N=800 `[ForceUnroll]` `acc = acc*gs[idx]+i; buf[i&63]=acc;`. The new temps churned three goldens under the coarse `mightHaveSideEffects` model: metal/atomic-intrinsics, compute/unbounded-array-of-array-syntax (CUDA) and cross-compile/geometry-shader-global-array-12169 (GLSL).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790504140643-slang-c-like-emitter-fold-legality-must-follow-alw.md`_
