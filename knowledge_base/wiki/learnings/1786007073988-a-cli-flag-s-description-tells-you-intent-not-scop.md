---
title: "A CLI flag's description tells you intent, not scope — grep which emitter consumes it before asserting behaviour"
type: learning
topic: misc
source: learnings/1786007073988-a-cli-flag-s-description-tells-you-intent-not-scop.md
---

# A CLI flag's description tells you intent, not scope — grep which emitter consumes it before asserting behaviour

I told a user that omitting `[format(...)]` on a Slang `RWTexture2D` makes the compiler *infer* the format from `T`, and that `-default-image-format-unknown` "forces Unknown instead of guessing." I took that straight from the flag's own reference text (`docs/command-line-slangc-reference.md:457-459`: *"Set the format of R/W images with unspecified format to 'unknown'. Otherwise try to guess the format."*).

**It's true only on the via-GLSL path.** Two greps settle it:
```bash
grep -c getUseUnknownImageFormatAsDefault source/slang/slang-emit-glsl.cpp   # 1
grep -c getUseUnknownImageFormatAsDefault source/slang/slang-emit-spirv.cpp  # 0
```
And `slang-ir-resolve-texture-format.cpp` early-returns when the decl has no `IRFormatDecoration` — so on `-emit-spirv-directly` (the *default* SPIR-V path) a bare `RWTexture2D<float4>` is **already** `Unknown`. No inference happens and the flag is a no-op there.

**Rule:** a flag's doc string describes what the option is *for*. It does not tell you which backend, pass, or emitter reads it. Before asserting "flag X does Y", grep the accessor across the consumers (`slang-emit-*.cpp`, the relevant IR passes) and state the path your claim applies to. This is the flag-level version of "read the source, not the docs."

**Two second-order lessons that generalize past this case:**

1. **A wrong mechanism under correct advice still needs correcting.** My practical recommendation ("always put an explicit `[format(...)]` on read-write textures") was right, and the correction made it *stronger* — the without-format capability dependency is unconditional on the direct path. It's tempting to let the mechanism slide when the conclusion holds. Don't: the user acts on the mechanism, and mine would have sent them to a flag that does nothing on their build.

2. **Don't inherit a subagent's hedge as a negative finding.** A research agent flagged `RWTexture2D.Store` as "DeepWiki-only, I didn't open a test — prefer the subscript." I relayed that hedge to the user. `.Store` is plainly declared at `hlsl.meta.slang:5244`. "My agent didn't verify it" is not evidence of absence — either verify it yourself or omit the claim, but don't pass the uncertainty along as if it were about the codebase rather than about your process.

**Also found while verifying (Slang-specific, reusable):** the published format table in `hlsl.meta.slang` (41 entries) omits `bgra8`, which nonetheless compiles and has two tests — authoritative list is `include/slang-image-format-defs.h` (45). And warning **31105** *silently substitutes* an unsupported format rather than erroring, so an exotic format string can go through as something else; **E31101** is the hard error for an unknown name.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786007073988-a-cli-flag-s-description-tells-you-intent-not-scop.md`_
