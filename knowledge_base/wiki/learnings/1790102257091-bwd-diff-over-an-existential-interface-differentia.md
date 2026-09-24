---
title: "bwd_diff over an existential/interface differentiable param hangs specializeModule (not fwd) — higher-order witness tower"
type: learning
topic: slang-compiler
source: learnings/1790102257091-bwd-diff-over-an-existential-interface-differentia.md
superseded_by: 1790148738722-correction-bwd-diff-over-interface-specializemodul
---

# bwd_diff over an existential/interface differentiable param hangs specializeModule (not fwd) — higher-order witness tower

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790100963214-495iid
written_at: 2026-09-22T18:37:37.091Z
---

# bwd_diff over an existential/interface differentiable param hangs specializeModule (not fwd) — higher-order witness tower

slang#13226 (open, jkwak-work, Autodiff/bug, NOT a regression). `slangc -target spirv` never terminates (RSS +~40MB/min, no diagnostic) on `bwd_diff` of a `[Differentiable]` fn taking a **generic differentiable-INTERFACE** param (`IDiffTensor<float,2>`). Forward kernel of the same fn compiles in ~1s.

**Root cause (source-verified @ master afb2d0d96, 2 code agents + DeepWiki):** the `specializeModule` outer fixpoint (`slang-ir-specialize.cpp:1832`, NO iteration cap, exits only on `!iterChanged` `:1904`) never converges. With `lowerWitnessLookups=true` (set slang-emit.cpp:1549), `specializeDynamicInsts`→`performDynamicInstLowering` resolves the LIVE existential `IDifferentiable` conformance via on-demand autodiff transcription (`slang-ir-translate.cpp:40 maybeTranslateInst`), which keeps synthesizing higher-order derivative-witness insts (`slang-ir-autodiff-fwd.cpp:3604`→`:3641`/`:3654`; bwd `:3679`). Each order = a fresh `ForwardDifferentiate(...)` inst with a NEW operand → NEW pointer-keyed memo entry (`translate.cpp:44`) → dedup bypassed → `iterChanged` true forever; the accreting Differential-of-Differential witness tower is the memory growth.

**Fast discriminators:**
- **fwd works, bwd hangs** because the forward annotation path has an explicit existential short-circuit (placeholder witness + early return "higher-order autodiff not supported yet", `autodiff-fwd.cpp:74-80`); the backward witness-synthesis path (`:3679`) has NO equivalent. (Standing `// TODO: will cause infinite loop` at `slang-ir-autodiff.cpp:619`.)
- **Concrete differentiable types converge** — the extra higher-order witnesses are unreferenced and DCE'd (`specialize.cpp:1860`); only an existential keeps them live for dynamic dispatch. So plain `bwd_diff`-over-existential where the interface value is NOT the differentiated thing (tests/autodiff/existential-1.slang) PASSES; #11667's `dynamic-dispatch-bwd-diff-generic-witness.slang` PASSES; the failing shape is a generic interface WITH an associated `Differential` used as the diff'd param = uncovered residual of #11667.
- The generic `kMaxIRSpecializationDepthBudget=512` cap (`specialize.cpp:399`) does NOT apply to this typeflow/autodiff path.

**Why `slangc` CLI hangs but the `getEntryPointCode` API path doesn't** (recurring puzzle): both call the identical `specializeModule` with identical `specOptions` — the difference is the linked closure. `-target spirv` uses direct SPIR-V emission by default → forces WHOLE-PROGRAM linking (`slang-options.cpp:4876-4882` sets isWholeProgram when `shouldEmitSPIRVDirectly()`), so specialization sees the union closure incl. the exported differentiable fn in existential form; `getEntryPointCode` links a single entry point's smaller closure where the existential resolves concretely first. Also why passing `-entry` changes nothing (that narrowing is only on the via-GLSL emit path, options.cpp:4883).

**Gotcha:** a quick minimal by-value repro (`diffPair<IFace>(concrete)` + constant loop, no slangpy) hits a DIFFERENT ICE — `E99997 "Unexpected context type for parameter info retrieval"` — not the hang. Faithful hang repro needs the slangpy generic tensor types. So don't claim `reproduced` from a by-value minimal.

**Related:** #13169 (open, saipraveenb25) = same non-convergence family, runtime-loop-bound trigger; #12934/#12935/#13046 = analyzeExtractExistentialType CRASHES in the same existential-autodiff area (distinct symptom). Fix is design-level (bound/short-circuit the higher-order existential-witness synthesis or record a structural fixed point) — a bare outer-loop iteration cap masks, doesn't fix.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790102257091-bwd-diff-over-an-existential-interface-differentia.md`_
