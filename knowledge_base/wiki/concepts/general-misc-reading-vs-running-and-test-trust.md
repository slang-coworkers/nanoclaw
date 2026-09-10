---
title: "Reading vs Running, and Trusting the Test"
type: concept
group: general-misc
tags: [reading-vs-running, test-trust, inert-claim, falsifier, deepwiki]
source_count: 0
---

# Reading vs Running, and Trusting the Test

## TL;DR
- Reading is not running — a two-minute experiment beats a plausible control-flow argument.
- When prose and a test disagree, trust the test.
- Green is weak for "my fix works", strong for "I changed nothing".
- Name the field that would falsify you, in advance.
- A widely-repeated behavioral claim can be inert — probe it several ways.
- DeepWiki can confidently contradict Slang source — verify against the local checkout on layout/ABI questions.

## DeepWiki Can Confidently Contradict Slang Source — Verify Against the Local Checkout on Layout/ABI

DeepWiki is a good PRIMARY for architecture/flow/phase-ordering ("where does X run relative to Y") — on #12092 its first answer (default 16+16=32, computed in `_createTypeLayout` before `inferAnyValueSizeWhereNecessary`) was correct and useful. But on a fine-grained "does A feed back into B" question it CONFABULATED: asked whether the inferred `anyValueSize` is propagated back into the reflection TypeLayout, it answered — in detail, with plausible file/function names — that it IS. That is FALSE: the reproduced bug (reflection=32 vs emitted ArrayStride=80) and the actual source (`slang-type-layout.cpp:5982-5987` reads only the AST `AnyValueSizeAttribute`, never the IR `IRAnyValueSizeDecoration`) both refute it. When DeepWiki's claim directly contradicts a reproduced observation, TRUST THE SOURCE + THE REPRO — and say so explicitly in the memo so the fixer doesn't chase the phantom path. Always cross-check DeepWiki layout/ABI claims against the local checkout before citing them in a verdict ([DeepWiki can confidently contradict Slang source — verify against local checkout on layout/ABI questions](../learnings/1784022527095-deepwiki-can-confidently-contradict-slang-source-v.md)).


## Reading is not running — a two-minute experiment beats a plausible control-flow argument

Repeatedly, a mechanism derived by *reading* source was refuted in minutes by *running* it, and the wrong mechanism implied a different, broken fix. Two apparently-identical crash sites — `spirv` at `glsl-legalize.cpp:5235-5241` and `metal` at `varying-params.cpp:4561-4567`, verified line-for-line to run the same five steps — were collapsed into "one null, three symptoms"; *running* both at `546ad18f7` showed spirv fails on an **arity** assert (payload dropped upstream, a release out-of-bounds read, not a null deref) and never reaches the getter, while metal passes arity and *then* nulls. **Structural identity of the code does not imply identity of the failure, because the two passes receive different IR** — so "diff the code shape" is demoted from a test of failure identity to a weak hint about shared provenance ([code shape is the wrong test for failure identity](../learnings/1785804467761-n-crash-signatures-is-a-hypothesis-about-count-not.md)). The CMake `file(DOWNLOAD … EXPECTED_HASH)` sequence is the cleanest instance: an HTTP 500 on the DXC CDN kills `configure` despite a working source-build fallback, and its "Building DXC from source instead" line does **not** mean the build recovered ([DXC prebuilt-fetch HTTP 500 signature](../learnings/1785759110494-dxc-prebuilt-fetch-http-500-fails-the-build-despit.md)) — **two** plausible read-the-code mechanisms were wrong ("the Error precedes the warning so the fallback never runs"; "EXPECTED_HASH is immediately fatal"). The real behavior is **deferred-fatal**: the error is recorded, the handler *is* reached, the fallback clones and configures DXC successfully, and configure still exits 1; a 15-line local A/B settles it in two minutes, and the job log's warning-*after*-error ordering already falsified the unreachable-handler story ([EXPECTED_HASH is deferred-fatal, the fallback does run](../learnings/1785759571154-correction-file-download-expected-hash-is-deferred.md)). The generalized form: a retry loop **alone does not help** (the last failed attempt raises the same error), fatal-on-failure and graceful-fallback cannot coexist in one call, `cmake -P` script mode is *immediately* fatal so a script-mode repro shows the wrong shape, and a shared retry helper must take the hash as a parameter and verify out-of-band or every call site inherits the defect ([EXPECTED_HASH is deferred-fatal in configure mode and defeats STATUS-based retry](../learnings/1785765561771-cmake-file-download-expected-hash-is-deferred-fata.md)). Two more: a triage claim that a feature needs new code collapsed when the command was actually **run** — SPIRV-Tools' `Optimizer::FlagHasValidForm` whitelists `-O`/`-Os`, and Slang forwards `-Xspirv-opt` verbatim, so `slangc -O0 -Xspirv-opt -Os` already runs the size preset (a passthrough's documented purpose does not bound what the downstream tool accepts), and the same file's `#elif`-blind grep inverted a dead/live verdict twice ([check whether a requested feature is already reachable, and prove it by running the command](../learnings/1785780759447-check-whether-a-requested-feature-is-already-reach.md)). And a byte-for-byte peer verification is not a correctness check: justifying a new path by showing it produces **the same value the incumbent produces** is circular — slang-rhi#802's `allocBufferHandle` returned `getDeviceAddress() + offset` for every buffer kind and discarded `format`, matching `metal-shader-object.cpp` exactly, which is why the equivalence review passed; typed `Buffer<float>` emits as `texture_buffer<…>` on a `[[texture(N)]]` slot needing a texture **resourceID**, and only an executed test killed it — validate against the *consumer's contract*, and treat `SLANG_UNUSED(param)` + "this doesn't matter" as a per-class red flag ([equivalence-to-incumbent is circular — a byte-for-byte review can pass a real bug](../learnings/1785767751083-equivalence-to-incumbent-is-circular-a-byte-for-by.md)).


## Green is weak for "my fix works", strong for "I changed nothing"

The same green signal carries opposite weight by claim: for "my fix works" it is a smoke test (may be inert, skipped, stale-binary, or watching an observable the bug cannot move); for "this refactor is behavior-preserving" it is close to the whole proof — but only after you enumerate where preservation could break first ([green is weak for "my fix works", strong for "I changed nothing"](../learnings/1785792616063-a-green-run-is-weak-evidence-for-my-fix-works-and-.md)).


## When prose and a test disagree, trust the test

A test is the artifact reality was forced to make true; self-consistent prose can never catch a contradiction, only prose-versus-tests can. Target universally-quantified words ("one per", "always", "each", "never") as the highest-yield disagreements ([when prose and a test disagree, the test is the artifact forced to be true](../learnings/1785800192069-when-prose-and-a-test-disagree-the-test-is-the-art.md)).


## Name the field that would falsify you, in advance

Generalized re-checking never converges on the deciding input: name the field whose change would invalidate the conclusion before acting, then re-read exactly that field at the moment of action (on #12281, naming `reviewDecision` and the approval's `commit_id` made a later webhook immediately interpretable). An expired conclusion must be closed, not annotated ([name the field that would falsify you, in advance](../learnings/1785799355770-name-the-field-that-would-falsify-you-in-advance-c.md)).


## A widely-repeated behavioral claim can be inert — probe it several ways

"Dropping `-o` flips the compile to `-whole-program`" was settled inert in ~30s by a four-way discriminating probe (two entry points × ±`-o` × ±`-entry`, counting `OpEntryPoint`): with `-entry` present the output is byte-identical and the flip touches only the `-g`-embedded command-line string ([dropping `-o` does not flip to whole-program when `-entry` is present](../learnings/1785791159290-dropping-o-does-not-flip-to-whole-program-when-ent.md)).

**Source learnings (11):**
- [DeepWiki can confidently contradict Slang source — verify against local checkout on layout/ABI questions](../learnings/1784022527095-deepwiki-can-confidently-contradict-slang-source-v.md) — DeepWiki can confidently contradict Slang source — verify against local checkout on layout/ABI questions
- [code shape is the wrong test for failure identity](../learnings/1785804467761-n-crash-signatures-is-a-hypothesis-about-count-not.md) — code shape is the wrong test for failure identity
- [DXC prebuilt-fetch HTTP 500 signature](../learnings/1785759110494-dxc-prebuilt-fetch-http-500-fails-the-build-despit.md) — DXC prebuilt-fetch HTTP 500 signature
- [EXPECTED_HASH is deferred-fatal, the fallback does run](../learnings/1785759571154-correction-file-download-expected-hash-is-deferred.md) — EXPECTED_HASH is deferred-fatal, the fallback does run
- [EXPECTED_HASH is deferred-fatal in configure mode and defeats STATUS-based retry](../learnings/1785765561771-cmake-file-download-expected-hash-is-deferred-fata.md) — EXPECTED_HASH is deferred-fatal in configure mode and defeats STATUS-based retry
- [check whether a requested feature is already reachable, and prove it by running the command](../learnings/1785780759447-check-whether-a-requested-feature-is-already-reach.md) — check whether a requested feature is already reachable, and prove it by running the command
- [equivalence-to-incumbent is circular — a byte-for-byte review can pass a real bug](../learnings/1785767751083-equivalence-to-incumbent-is-circular-a-byte-for-by.md) — equivalence-to-incumbent is circular — a byte-for-byte review can pass a real bug
- [green is weak for "my fix works", strong for "I changed nothing"](../learnings/1785792616063-a-green-run-is-weak-evidence-for-my-fix-works-and-.md) — green is weak for "my fix works", strong for "I changed nothing"
- [when prose and a test disagree, the test is the artifact forced to be true](../learnings/1785800192069-when-prose-and-a-test-disagree-the-test-is-the-art.md) — when prose and a test disagree, the test is the artifact forced to be true
- [name the field that would falsify you, in advance](../learnings/1785799355770-name-the-field-that-would-falsify-you-in-advance-c.md) — name the field that would falsify you, in advance
- [dropping `-o` does not flip to whole-program when `-entry` is present](../learnings/1785791159290-dropping-o-does-not-flip-to-whole-program-when-ent.md) — dropping `-o` does not flip to whole-program when `-entry` is present
