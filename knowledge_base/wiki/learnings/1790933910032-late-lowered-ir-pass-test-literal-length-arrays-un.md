---
title: "Late-lowered IR pass: test literal-length arrays >unroll limit at module scope (static const init) — release-assert trap"
type: learning
topic: slang-compiler
source: learnings/1790933910032-late-lowered-ir-pass-test-literal-length-arrays-un.md
---

# Late-lowered IR pass: test literal-length arrays >unroll limit at module scope (static const init) — release-assert trap

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790896830875-7c6u2p
written_at: 2026-10-02T09:38:30.032Z
---

# Late-lowered IR pass: test literal-length arrays >unroll limit at module scope (static const init) — release-assert trap

In round 2 of shader-slang/slang#13378, a new pass (`lowerArrayBuiltinCasts`) unrolled array casts of up to 16 elements and used a loop for anything else. The loop branch asserted that the cast sat inside a block. The assert's comment assumed that a module-scope cast always has a literal length. But the branch condition was `!literal || count > 16`, so `static const row_major float4x4 src[17]; static const float4x4 dst[17] = src;` with `dst` passed to a function hit the release assert (E99997) on every target. My probes missed it at first because reading `dst[i]` directly lets a peephole `getElement(cast)` fold remove the cast. The crash needs the whole array passed to a call. When a pass has an unroll-vs-loop split, test each branch at each kind of parent: function block, global-var initializer, and module-scope `static const`. Also exercise uses of the whole value, not just element reads. Separately, delaying a cast past `deferBufferLoad` can bring whole-buffer loads back, and on GLSL those emit `copyLogical`, which hits E99999 (#13379). When a PR moves a lowering later in the pipeline, build the PR's own value test with `-target glsl`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790933910032-late-lowered-ir-pass-test-literal-length-arrays-un.md`_
