# Three plausible mechanisms attached to correct observations, all wrong: separate the observation from the story before publishing

From triaging shader-slang/slang#12441 (two SPIR-V emit bugs) at master `716ec597fc9c85111cd2fa06ba4e89bc4469b6b2`. Every *observation* I made survived review. **Three of the mechanisms I invented to explain them did not.** All three would have gone onto a MEMBER's issue.

## The three

**1. "The fix must also cover `isSignedType`."** I saw `snorm float` (a *signed* format) emit `OpUDiv` rather than `OpSDiv`, found `isSignedType` (`slang-ir-util.cpp:3038`) has the same missing `AttributedType` case, and published "one root, two wrong choices". **Wrong.** `slang-emit-spirv.cpp:853` reads `isFloatingPoint ? SpvOpFDiv : isSigned ? SpvOpSDiv : SpvOpUDiv` — once the classifier unwraps and sees `Float`, `isSigned` is **never consulted** for `Div`. It only *explains* which wrong integer opcode the already-wrong branch picked. A single unwrap fixes all six measured cases. I had invented a second required fix.

**2. "The vector case passes because `OpVectorShuffle` produces a fresh `%v2float`."** Measured: scalar `unorm float` fails, `unorm float2`/`float4` pass. The story fit the disassembly perfectly. **Wrong, and backwards** — opcode selection (`:10337-10339`) happens *before* operands are emitted, so a later SPIR-V instruction cannot explain the choice. Worse, my own IR dump then disproved it: the vector operand really is `Attributed(Vec(Float,2), …)`, and `getVectorElementType` (`slang-ir-util.cpp:44`) uses `as<IRVectorType>`, which does **not** look through the wrapper — so the vector path *ought* to be blind too, yet emits `OpFAdd`. I published the contrast as measured with the cause **explicitly not established**.

**3. "The consumer-side unwrap is right because the attribute is load-bearing for image-format deduction."** True that `slang-emit-spirv.cpp:3291-3335` reads `UNormAttr`/`SNormAttr` to deduce `R8`/`R8Snorm`. But that reads the attribute off the **resource's sampled type** — not off the **loaded scalar** whose wrapper causes the bug. **Two different types.** My evidence did not support my conclusion; I re-argued the layer from the emitter invariant (36 `unwrapAttributedType` call sites, 7 already in that one file) and explicitly left producer-vs-consumer ownership to the maintainer.

## Why this class is dangerous

⭐**A wrong mechanism riding a correct conclusion draws no pushback from outcomes.** In all three cases the *decisions* were right — real bug, defensible fix, real coverage gap — so nothing downstream misbehaves, no test fails, and a reviewer agreeing with the verdict never examines the reasoning. The mechanism is the part nobody re-derives.

⭐**Tidiness is the warning sign, not the evidence.** Each story was *neater* than the truth: "two blind spots, one root" is more satisfying than "one blind spot with a secondary effect"; "the shuffle makes a fresh type" is more satisfying than "we don't know why vector escapes".

## Operable rules

- **State the observation and the mechanism as two separate claims, and mark the mechanism's confidence separately.** "Scalar fails, vector passes" and "here is why" have wildly different evidence.
- **Before publishing a mechanism, check the ORDER of operations.** #2 died on a pure ordering fact: the thing I blamed happens after the decision it supposedly caused.
- **Check that your evidence is about the same OBJECT as your conclusion.** #3 was evidence about a resource type supporting a claim about a value type.
- ⭐**"I don't know why" is publishable when the observation is load-bearing.** The scalar/vector contrast dictated the regression-test shape (a vector texel would pass before the fix), so it *had* to be published — the mechanism did not.
- **Ask an adversary to attack the mechanisms specifically**, not the conclusions. Five critique rounds on this triage: every finding was a mechanism or a scope/unit error; the verdict never moved.

## Bonus unit/instrument traps from the same chain

- **A "files mentioning X" count is often the wrong instrument.** `unorm|snorm` in `tests/` = 7 case-sensitive vs 17 case-insensitive `.slang` files — the extra 10 are `Unorm`/`Snorm` inside *intrinsic names* (`unpackUnorm`), not type modifiers. The decisive count was the **declaration** count: scalar `RWTexture2D<unorm|snorm float>` = **0**, against a control of **118 `.slang` files** using `RWTexture2D` at all.
- **State a count's universe.** 121 `RWTexture2D` files = 118 `.slang` + 3 `.hlsl`/`.expected`. A reviewer flagged "+2"; the partition control (118+3=121) is what settles it.
- **A per-line `grep` on a wrapped file gives false zeros.** Two of my post-edit verifications read 0 for text that was present — the phrase spanned a line break. Collapse whitespace before verifying, and pair every zero with a must-hit control.
