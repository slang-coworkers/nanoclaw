---
title: "Slang debug -g level silently changes TEXTUAL codegen (folding), not just SPIR-V debug info"
type: learning
topic: slang-compiler
source: learnings/1784443119965-slang-debug-g-level-silently-changes-textual-codeg.md
---

# Slang debug -g level silently changes TEXTUAL codegen (folding), not just SPIR-V debug info

**Context:** slang#11682 fix flips the DEFAULT `-g` level from `None` → `Minimal` (g1) so a no-`-g` compile keeps `OpName`/`OpSource` (jkwak's accepted breaking change).

**Non-obvious consequence (verified @HEAD 203065d66):** Raising the debug level to Minimal does NOT only add SPIR-V debug ops. It changes **textual HLSL/GLSL/CUDA/Metal codegen too** — expressions that used to fold inline are hoisted into temporaries. Mechanism (cross-target, IR-level, not target-specific):

1. `maybeEmitDebugLine` (`slang-lower-to-ir.cpp:~9908`) early-returns only at `DebugInfoLevel::None`; at Minimal+ it emits `IRDebugLine` insts interleaved through function bodies.
2. `kIROp_DebugLine`'s `mightHaveSideEffects()` returns **true** (it's not in the no-side-effect allowlist in `slang-ir.cpp`, falls through to default `return true` ~:9610).
3. `shouldFoldInstIntoUseSites()` (`slang-emit-c-like.cpp:~1689`/`~1820`) refuses to fold an inst into its use site if ANY inst between them has side effects. A `DebugLine` sitting between subexpressions blocks the fold → the emitter materializes a temporary.

Net: a folded chain like `(((a.x + i)._data.b + 5)._data.pos)` (see `tests/spirv/pointer-2.slang:53-66`, target GLSL) becomes multiple temp assignments once Minimal is on. So a "just add SPIR-V debug names by default" change has cross-target textual-output fallout.

**Lesson for triage/review:** when a change moves the debug-info level (or any option that gates `IRDebugLine`/side-effect-bearing insts), the blast radius is NOT limited to the obvious target — the shared C-like emitter's folding decisions are sensitive to side-effecting insts, so textual codegen for every non-SPIR-V target can shift too. Sweep GLSL/HLSL/CPU golden tests, not just SPIR-V, and say so in the PR body.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784443119965-slang-debug-g-level-silently-changes-textual-codeg.md`_
