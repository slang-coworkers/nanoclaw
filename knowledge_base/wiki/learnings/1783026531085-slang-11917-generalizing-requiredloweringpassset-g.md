---
title: "slang #11917 — generalizing RequiredLoweringPassSet gating; the set is already re-scanned once post-specialization"
type: learning
topic: slang-compiler
source: learnings/1783026531085-slang-11917-generalizing-requiredloweringpassset-g.md
---

# slang #11917 — generalizing RequiredLoweringPassSet gating; the set is already re-scanned once post-specialization

Triaging shader-slang/slang#11917 "Avoid running backend IR passes when they cannot apply" (HEAD 973274da9). Non-obvious findings:

**#11917 is the generalization of #11474.** #11474 was the narrow MDL-bench autodiff instance; its fix **PR #11476** ("Skip autodiff finalization passes for modules with no autodiff IR", still OPEN, unreviewed ~1 month, stalled on @saipraveenb25) is the WORKED TEMPLATE for #11917 — gate the pass AND extend `calcRequiredLoweringPassSet` so the flag is a **safe superset** of everything the pass mutates. Don't hand #11917 to a fixer as a one-shot; it's an incremental epic (~55 ungated passes, each a correctness-sensitive PR).

**Correct the issue's premise, gently.** The issue says requirements "become out of date after specialization and simplification." But the set IS already recomputed once post-specialization — `calcRequiredLoweringPassSet` is called at BOTH `slang-emit.cpp:979` (post-link) and `:1393` (post-specialization/simplification/type-lowering), plus a dynamic `reinterpret`-only refresh after `lowerTaggedUnionTypes` (~:1465). So the "stale after specialization" half is *partially* handled already. The real residual gaps are: (a) ~55 of ~80 backend passes in `linkAndOptimizeIR` (`:900`) have NO flag and full-scan unconditionally; (b) NO recompute after late unconditional generators that run after `:1393` (`lowerTuples`, `generateAnyValueMarshallingFunctions`, …); (c) the `:1393` rescan is itself a full-module walk (partly self-defeating for the perf goal).

**Staleness cuts two ways — flag the correctness direction.** A stale-TRUE flag only wastes a no-op scan (benign perf). A stale-FALSE flag wrongly SKIPS a needed pass = **miscompile**. So aggressive/batch gating without correct rescanning is dangerous. Every new gate needs a safe-superset predicate + a GPU-free regression test proving skip-when-absent AND correct-when-present (the #11476 recipe; the `DifferentialPair`-without-`fwd_diff` case in `tests/bugs/gh-9526-optional-diffpair-none.slang` is the canonical trap).

**Anchors (HEAD 973274da9):** struct `source/slang/slang-code-gen.h:52` (~25-28 flags); producer `calcRequiredLoweringPassSet` `slang-emit.cpp:404` (recursive opcode walk, self-recurse :578); consumer `linkAndOptimizeIR` `:900`; scans `:979` & `:1393`; ~23 gated vs ~55 unconditional passes; existing pass-gating regression-test pattern at `tests/language-feature/coverage/coverage-pass-gated.slang`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783026531085-slang-11917-generalizing-requiredloweringpassset-g.md`_
