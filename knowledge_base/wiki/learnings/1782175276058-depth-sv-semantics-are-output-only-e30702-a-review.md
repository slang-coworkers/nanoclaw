---
title: "Depth SV semantics are output-only (E30702) — a reviewer-traced 'inout duplicate' gap can be unreachable"
type: learning
topic: review-process
source: learnings/1782175276058-depth-sv-semantics-are-output-only-e30702-a-review.md
---

# Depth SV semantics are output-only (E30702) — a reviewer-traced 'inout duplicate' gap can be unreachable

On shader-slang/slang, `SV_DepthGreaterEqual` / `SV_DepthLessEqual` (and `SV_Depth`) used as a fragment **input** or `inout` param are rejected by the semantic checker with **E30702** ("system value semantic '...' cannot be used as input in 'pixel' shader stage"). Verified by compiling `void f(float a, inout float depth : SV_DepthGreaterEqual)` → `rc=255`, E30702.

Lesson (general): a code-reading reviewer flagged a "duplicate `layout(depth_*)` emission for an `inout` depth param" because `createGLSLGlobalVaryings` runs for both VaryingInput and VaryingOutput. The trace was correct *as far as it went*, but the input varying never reaches GLSL legalization — the front-end forecloses it upstream (E30702). So the hypothesized bug path was unreachable, and a regression test built around it (`inout float : SV_DepthGreaterEqual`) simply fails to compile.

Takeaways:
- Before adding a regression test for a reviewer-traced "gap", *try to construct the triggering input and compile it*. If it's rejected upstream, the gap is unreachable — say so with the diagnostic code as evidence, and don't ship a test that can't compile.
- Still worth applying the defensive/precedent-matching fix: I gated the kind on `VaryingOutput` (mirroring `sv_position`) and added the new ops to `isSimpleDecoration` (mirroring `EarlyDepthStencilDecoration`, so `addDecoration` dedupes operand-0 "simple" decorations). Both are cheap, document the output-only invariant, and make the decoration idempotent by construction.
- `isSimpleDecoration` (source/slang/slang-ir.cpp) is the dedup allowlist: a 0-operand decoration listed there is deduplicated by `addDecoration`; the `early_fragment_tests` decoration is in it, which is why its set-site needs no idempotency guard.
- Plain `SV_Depth` on the GLSL target writes `gl_FragDepth = ...;` but does NOT emit an `out float gl_FragDepth;` redeclaration (it's a builtin) — so a negative test should assert absence of the directional qualifier/extension and anchor on `gl_FragDepth`, not on an out-declaration.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782175276058-depth-sv-semantics-are-output-only-e30702-a-review.md`_
