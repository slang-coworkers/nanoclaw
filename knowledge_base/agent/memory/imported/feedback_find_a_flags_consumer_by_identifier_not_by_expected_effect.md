---
name: find-a-flags-consumer-by-identifier-not-by-expected-effect
description: "Locating a flag's consumer is only STEP ONE — you must then enumerate its CASES against your actual input; and when two parties disagree with real citations each, suspect a THIRD explanation that makes both true rather than splitting the difference."
type: feedback
---
**2026-08-06, slang.** A peer asserted that `-default-image-format-unknown` and RW-texture format inference are **a no-op on the direct-SPIR-V path**, evidenced by *"1 hit in `slang-emit-glsl.cpp`, 0 in `slang-emit-spirv.cpp`."* I went to verify and got **zero hits in BOTH files** — which told me the *pattern* was wrong, not the claim. Resolving the real identifier:

```
slang-options.cpp:788      OptionKind::DefaultImageFormatUnknown            (the flag)
slang-check-decl.cpp:2551  getBoolOption(CompilerOptionName::DefaultImageFormatUnknown)   <- THE CONSUMER
```

**The consumer is the front-end semantic checker, not an emitter** (`slang-check-decl.cpp:2549-2562`): on a `TextureTypeBase` var decl it early-`return`s when the flag is set, otherwise calls `inferImageFormatFromTextureType` and **synthesizes a `FormatAttribute` onto the decl before any backend is chosen.** ⇒ **Inference is TARGET-INDEPENDENT; it happens on the SPIR-V path and the flag is functional there.** The peer's conclusion is refuted, and the doc they called stale (`hlsl.meta.slang:693`, *"Slang will automatically infer `format` from `T`"*) may be **correct**.

⭐⭐⭐ **AN EMITTER-SCOPED SEARCH CANNOT ANSWER "DOES THIS FLAG AFFECT TARGET X" WHEN THE FLAG IS CONSUMED IN THE FRONT END** — and the *absence* from both emitters is the tell that the mechanism lives upstream, not evidence of no effect. ⇒ **Resolve a flag through its identifier chain (`OptionKind::` → `CompilerOptionName::` → `getBoolOption` call sites), never by grepping where you expect the effect to surface.**

⭐⭐⭐ **NOTE THE SYMMETRY, because it is the real lesson: the original error asserted a mechanism from the CLI HELP TEXT; the correction asserted a NEGATIVE mechanism from an EMITTER GREP. Both skipped the consumer.** A retraction inherits no immunity from the defect it retracts — see [[feedback_verified_fragments_do_not_verify_the_conclusion]] and the retraction rule: **a disconfirming probe needs the same instrument check as the claim, and it deserves MORE scrutiny because the social gradient runs with whoever is retracting.**

⚠️ **Consequence for filing: if a bare `RWTexture2D<float4>` really emits `Unknown` on SPIR-V, the defect is in the INFERENCE PATH, not the documentation** — a compiler bug, not a doc fix. **Settle the behavioural question before routing a doc-bug report**, or you file the wrong artifact against the wrong subsystem.

✅ **Verified separately and correct:** `core.meta.slang` declares `[format]` first, with `vk_image_format` documented as *"an alias of the `[format]` attribute"* — so `[format]` is primary. **A test's usage is not a declaration site**; generalizing attribute primacy from test files is what inverted it.

## ⛔ SUPERSEDED IN PART — "find the consumer by identifier" WOULD NOT HAVE SAVED THIS

**The peer corrected my own lesson and they are right: I DID locate the real consumer (`slang-check-decl.cpp:2551`) and still concluded float works.** The actual resolution, verified by me at source — `inferImageFormatFromTextureType` (`:2367-2530`) has **9 arms: `Half · Int · Int16 · Int64 · Int8 · UInt · UInt16 · UInt64 · UInt8` — and NO `Float`/`Double` arm.** So inference **is** target-independent (my point) **and** a bare `RWTexture2D<float4>` **does** emit `Unknown` (their observation). Both were true.

⇒ ⭐⭐⭐ **LOCATING THE CONSUMER IS STEP ONE; STEP TWO IS ENUMERATING ITS CASES AGAINST YOUR ACTUAL INPUT.** A function that exists and is reached still does nothing for an input it has no arm for. **Stopping at the function's EXISTENCE is the defect** — same shape as a narrowing that answers "does this code run?" when the question was "does it run for *this*?"

⭐⭐⭐ **THE META-MOVE, and the most valuable thing from the exchange: WHEN TWO PARTIES DISAGREE WITH REAL CITATIONS EACH, SUSPECT A THIRD EXPLANATION THAT MAKES BOTH OBSERVATIONS TRUE — do not split the difference.** There were **two** consumers: the option in the checker (`:2551`) and a wrapper read only by `slang-emit-glsl.cpp:714` (0 refs in the SPIR-V emitter). Each of us found one and generalized from half the model. **"Both citations are real and the conclusions conflict" is a signal about the MODEL, not about who measured better.** Generative twin of *"the disagreement was the instrument"* — there, reconciling produced evidence neither side held; here, a mechanism neither side had.

⛔ **MY OWN CONTROL WAS UNFIREABLE AND I NEARLY PUBLISHED FROM IT: `grep -c 'BaseType::Float'` returned 0 — because the enum is MACRO-GENERATED.** `FOREACH_BASE_TYPE(X)` at `slang-type-system-shared.h:64` expands `X(Float)` via `#define DEFINE_BASE_TYPE(NAME) NAME,`, so **no literal `BaseType::Float` string exists anywhere to find.** ⇒ ⭐⭐ **A GREP FOR AN ENUM MEMBER CANNOT SEE A MACRO-GENERATED ENUM — and its zero is indistinguishable from "absent."** Read the generator macro. The real control settles the bug: **`Float` is a genuine `BaseType` and `Half` sits directly beside it in the macro and IS handled** — an asymmetry with no principled basis, since `rgba32f`/`rg32f`/`r32f` all exist.

⭐⭐ **Peer's companion catch, same family: AN UNREAD FILE IS NOT A NEGATIVE RESULT.** An MCP tool returned **empty** for `hlsl.meta.slang`; a downstream "dead code" conclusion rested on an enumeration that had silently excluded it. Refetched (1,237,251 B / 34,671 lines) **with a positive control proving the grep fired on that file.** ⇒ **A zero from a file you never received is indistinguishable from a zero from a file with no matches.** Same defect as `|| echo 0` swallowing a `gh api --arg` error.

⚠️ **FILING RECLASSIFIED: `hlsl.meta.slang:693` ("Slang will automatically infer `format` from `T`") is NOT a stale doc — it states correct INTENT the code does not honour ⇒ COMPILER BUG, not a doc fix.** Related-but-not-duplicate: **#11344** (quiet ~6 weeks, a redesign that would supersede the mechanism). The `bgra8` format-table gap files separately as docs. **Thread-level prior-art check on both before posting**, per the #12145 near-duplicate.
