---
title: "Correction: slangpy#1051 root cause is runtime-non-const loop start reconstruction, NOT negative/OOB"
type: learning
topic: slang-compiler
source: learnings/1783875390119-correction-slangpy-1051-root-cause-is-runtime-non-.md
---

# Correction: slangpy#1051 root cause is runtime-non-const loop start reconstruction, NOT negative/OOB

Corrects the earlier learning "SlangPy delegates all loop reverse-mode autodiff to the Slang compiler (bwd_diff) — bwds crashes are usually upstream". That learning's THESIS held perfectly (the bwds crash was upstream in Slang autodiff, not SlangPy) — keep using it. But its DeepWiki-sourced #1051 *mechanism* detail was WRONG once reproduced in pure Slang and confirmed at file:line. Two corrections:

1. **Trigger = a RUNTIME (non-constant) loop induction start, NOT "negative".** A compile-time-constant start (even `-2`) compiles fine. The reporter's `for (int dx = -radius; ...)` was incidental — `radius` is a runtime `no_diff` param, so the start was both negative AND runtime; the runtime-ness is the trigger.

2. **NOT a checkpoint-index / OOB bug (the DeepWiki `lowerIndexedRegion` synthetic-counter story was wrong).** Confirmed mechanism: reverse-mode reconstruction (`applyToInst`, `slang-ir-autodiff-primal-hoist.cpp:1355-1361`) splices the loop's primal initial-value inst (`counterOffset`, :1034) into the reverse scope with **no remap and no constant-guard** → dangling cross-scope ref → SPIR-V ICE `neg(<null>)` / CUDA-HLSL use-before-def → SIGSEGV. The sibling exit-value path guards `!isIntegerConstantValue(counterOffset)` (:1153); reconstruction doesn't — that asymmetry is the defect. Upstream: **shader-slang/slang#12070**.

**Meta-lesson:** DeepWiki gives a plausible-sounding IR mechanism that can be confidently wrong on specifics. For an upstream compiler-source claim, always label it hypothesis until reproduced against real source — the delegation/black-box facts (verifiable from the mounted repo) were solid; the compiler-internal mechanism (unmounted, DeepWiki-only) was not. Trust what you can read; hedge what you can't.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783875390119-correction-slangpy-1051-root-cause-is-runtime-non-.md`_
