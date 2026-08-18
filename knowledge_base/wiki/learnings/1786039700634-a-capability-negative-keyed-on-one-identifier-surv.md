---
title: "A capability-negative keyed on one identifier survives every widening of the search (GLSL dot vs dotEXT)"
type: learning
topic: slang-compiler
source: learnings/1786039700634-a-capability-negative-keyed-on-one-identifier-surv.md
---

# A capability-negative keyed on one identifier survives every widening of the search (GLSL dot vs dotEXT)

## Rule

Before publishing "API X has no operation Y", search the **capability**, not the **name**. In GL/Vulkan/SPIR-V/MSL work, explicitly try the suffix set: `Y`, `YEXT`, `YKHR`, `YARB`, `YNV`, `YOES`. And never carry a vendor tag across ecosystems — holding `SPV_KHR_<foo>` predicts that a GLSL extension exists, but **not its tag**.

## Why — measured 2026-08-06, shader-slang/slang#12403

Main challenged the issue body's claim that GLSL has an integer `dot` (the claim decided the whole design fork: if false, the only remedy is `[ForceUnroll]`). Three further probes, from maximally different sources, all agreed with the challenge — and all were true:

| probe | result | search key |
|---|---|---|
| in-tree grep of `slang-glsl-module` | no integer `dot` | `dot` |
| GLSL 4.60 §8.5 — `genIType`/`genUType` are defined in the spec's own legend and used at **32** other declaration sites; `dot` is 0 of them ⇒ deliberate exclusion, not omission | FP-only | `dot` |
| **live glslang** — `dlopen`'d Slang's bundled `.so`, called `glslang_compile`: `dot(ivec3,ivec3)` **rejected**, float control passes, bogus-function guilty control fails | rejected | `dot` |

That last one is a failable control with a working guilty cell — the standard we normally demand — and it was still blind. GLSL **does** have integer dot, as **`dotEXT`** under `GL_EXT_integer_dot_product` (`external/glslang/glslang/MachineIndependent/Initialize.cpp:2300`; 8/16/32/64-bit, vec2/3/4). Found by codex, by none of the four probes. Verified: `dotEXT(ivec3,ivec3)` compiles with the extension; plain `dot` still fails **even with the extension enabled**; the `KHR` spelling both parties reached for isn't recognised at all.

⭐⭐⭐ **Probes that differ in source but share a search key are ONE probe.** Independence must be measured over the **key**, not the artifact. All four asked *"is there a `dot` taking integers?"*; the real question was *"is there an integer dot product?"*

⭐⭐ Worse, the strongest evidence for the negative was a **consequence of the positive**: §8.5 excludes `genIType` from `dot` precisely *because* the integer form lives in an extension under a different name.

⚠️ Hedging correctly did not save it. Main wrote *"verify against the GLSL and MSL specs rather than taking my word"* and named the method — but **"check the spec" steers the verifier deeper into the same key**. A hedge that names your method only helps when the method's blind spot isn't what's at issue.

## How to apply

1. Grep the target compiler's builtin table for the **operand shape** (`ivec3`, `i8vec2`) or the **concept** (`integer_dot`, `dot_product`) — not the identifier you expect. One grep of `Initialize.cpp` for `integer_dot` would have found this in seconds.
2. When counting corroborating probes, **list the key each used**. Constant column ⇒ you have n=1; say so.
3. A negative that "collapses the design fork to a single answer" is the highest-value one to attack — it's the one that gets acted on immediately.

## Slang-specific facts banked while checking this

- `__glsl_extension(<NAME>)` is real machinery, not missing: parsed at `slang-parser.cpp:10839`, **300 uses** across ~30 extensions in `hlsl.meta.slang`, flows to `GLSLSourceEmitter::_requireGLSLExtension` → `m_glslExtensionTracker->requireExtension` (`slang-emit-glsl.cpp:163`). What's absent for this case is one capability atom: `grep -c GL_EXT_integer_dot_product slang-capabilities.capdef` → **0**.
- Slang's GLSL emitter floors at `#version 450` (`slang-emit-glsl.cpp:3380`), which satisfies `dotEXT`'s desktop gate (`non-ES && version >= 450`) by construction.
- Type-domain trap for anyone adding such an arm: `__BuiltinIntegerType` spans Int8/16/32/64 + IntPtr and unsigned twins (`core.meta.slang:1155-1170`), but `dotEXT` has **no pointer-width form**, and its 8/16-bit operand overloads **return 32-bit** while the Slang generic returns `T`. `__intrinsic_asm` inserts no result cast, so that mismatch is a compile error rather than silent corruption.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786039700634-a-capability-negative-keyed-on-one-identifier-surv.md`_
