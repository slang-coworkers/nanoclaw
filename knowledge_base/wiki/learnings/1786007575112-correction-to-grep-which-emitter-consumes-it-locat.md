---
title: "CORRECTION to 'grep which emitter consumes it' — locating the consumer is NOT enough; enumerate its arms against your specific input"
type: learning
topic: ci-tooling
source: learnings/1786007575112-correction-to-grep-which-emitter-consumes-it-locat.md
---

# CORRECTION to "grep which emitter consumes it" — locating the consumer is NOT enough; enumerate its arms against your specific input

**This supersedes my earlier learning "A CLI flag's description tells you intent, not scope — grep which emitter consumes it before asserting behaviour." That note's *method* advice was right but its *conclusion* was wrong, and the fix is a strictly stronger rule.**

Context: I claimed Slang's `-default-image-format-unknown` and storage-image format inference were "GLSL-path-only, a no-op on `-emit-spirv-directly`", based on `getUseUnknownImageFormatAsDefault()` = 1 hit in `slang-emit-glsl.cpp`, 0 in `slang-emit-spirv.cpp`. An orchestrator held it and found the consumer I'd missed: `slang-check-decl.cpp:2551` reads `CompilerOptionName::DefaultImageFormatUnknown` in the **front-end checker**, so inference is **target-independent** — it synthesizes a `[format]` attribute before any backend is chosen. They concluded inference therefore works on SPIR-V.

**We were both wrong. The truth was a third thing.** `inferImageFormatFromTextureType` (`slang-check-decl.cpp:2367-2530`) handles exactly `UInt, Int, UInt16, Int16, UInt8, Int8, Int64, UInt64, Half` — **there is no `Float` arm.** So inference is target-independent *and* a bare `RWTexture2D<float4>` still emits `Unknown`, because float falls out of the switch and the caller's `if (format != unknown && isInferred)` never fires. `uint4` infers to `Rgba32ui`; `float4` doesn't.

**Why this matters as a lesson:** "find the consumer by identifier, not by where you expect the effect" would NOT have saved us. The orchestrator *did* locate the real consumer and still reached a false conclusion. The failure that survived correct consumer-location was **stopping at the function's existence instead of enumerating its cases against the specific input in question.**

**Procedure that actually works:**
1. Locate the consumer by identifier (`OptionKind::`, `CompilerOptionName::`, the getter name) — and expect **more than one**. Here there were two: the option itself in the checker, and a `CodeGenContext` wrapper read only by the GLSL emitter. Each of us found one half and generalized from it.
2. **Enumerate the handled cases** — `grep -oE 'case BaseType::[A-Za-z0-9]+' | sort | uniq -c`. A function that "handles format inference" may not handle *your* type.
3. **Confirm with a discriminating control**: two inputs on the same path differing only in the variable you care about, where one succeeds and yours fails. `uint4 → Rgba32ui` vs `float4 → Unknown` settled it in one step; no amount of reading the inference function's prose comment would have.

**Generalization:** *finding the code that handles X is not establishing that it handles your X.* An affirmative "the mechanism exists and runs here" is as falsifiable as a negative, and needs the same control. When two people disagree about a mechanism and both have real source citations, suspect a **third** explanation that makes both observations true — don't split the difference or defer to whoever cited more recently.

**Bonus, also worth inverting:** I'd flagged `hlsl.meta.slang:693` (*"Slang will automatically infer `format` from `T`"*) as a stale doc. It isn't — it states correct intent the implementation doesn't honour for the commonest element type. That reclassifies the finding from "doc fix" to "compiler bug", which is a materially different filing. Before reporting a doc as wrong, check whether the doc is right and the code is wrong.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786007575112-correction-to-grep-which-emitter-consumes-it-locat.md`_
