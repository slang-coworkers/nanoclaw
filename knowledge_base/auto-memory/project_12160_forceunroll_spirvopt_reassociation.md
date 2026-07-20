---
name: project_12160_forceunroll_spirvopt_reassociation
description: "#12160 [ForceUnroll] SPIR-V fp reassociation precision loss — NOT Slang IR bug; bundled spirv-opt reassociates; design-gated on #11933"
metadata: 
  node_type: memory
  type: project
  originSessionId: ed537b35-3e09-49aa-ab71-5aa86b8644e3
---

# #12160 — [ForceUnroll] float precision loss in SPIR-V

**Repo:** shader-slang/slang · **Author:** koubaa (external CONTRIBUTOR) · **Reported:** 2026-07-19 · **Slang 2026.13, linux/vulkan**
**Thread:** `gh-issue-shader-slang/slang-12160`

## Symptom
`[ForceUnroll]` + `-target spirv` at default opt: `area[1]≈0.9869` (expect `1.0`) for `input={1,1,1,0}`. Reporter mis-titled it "[ForceInline]" but repro uses `[ForceUnroll]`.

## Root cause (triager-VERIFIED at HEAD a916653b7, GPU-free, float32 model reproduces 0.986895 exactly)
**NOT a Slang IR bug** — PROVEN via `-dump-ir` (43k lines, no folded constant): Slang keeps `xmin = sub(x, 1e-06)`, denom `xmax - xmin` exactly as written through emission. The **bundled spirv-opt** (runs only when opt > `-O0`; gated at `slang-emit.cpp:3329`) reassociates `(xmax0-min) - (min-1e-6)` via `folding_rules.cpp`, folding `1e-6 - 1 = -0.999998987` → catastrophic cancellation when true denom ~1e-6.
- Folding gates on `IsFloatingPointFoldingAllowed()` (`instruction.cpp:830`) = `!NoContraction`. Default fp-mode emits **zero** `NoContraction` (deliberate, #11933; test `fp-mode-precise-nocontraction.slang:30-31` asserts `//DEFAULT-NOT: NoContraction`).
- **Verified matrix:** `-O0` OK / `-O1..3` BUG / no-`[ForceUnroll]` OK / `-fp-mode precise` OK / `-fp-mode fast` BUG.

## Design intent (the gate)
Default fp-mode emits **NO `NoContraction` BY DESIGN** (#11933 + regression test asserts `//DEFAULT-NOT: NoContraction`) → spirv-opt is free to reassociate. So this is a deliberate shipped tradeoff, not an accident.

## Workaround (VERIFIED, corrected)
**Global `-fp-mode precise` ONLY** — fixes it at every opt level.
**Per-function `[precise]` does NOT work on the direct SPIR-V path** (fixer verified at source: the SPIR-V emitter's NoContraction gate reads global fp-mode + autodiff-internal override only, never `IRPreciseDecoration` — `slang-emit-spirv.cpp:10257-10266`; `[precise]`→IRPreciseDecoration is consumed only in `slang-emit-c-like.cpp`). Triager's original posted workaround was partly wrong on this; public issue comment **5017829442 PATCHED in place** to read "global `-fp-mode precise` only; per-function `[precise]` does not work on SPIR-V."
- Opt gate nuance: the true `-O0` protection is glslang's zero-pass early-return, not downstream-compiler invocation.

## Disposition — Approach A (recommended by triager)
Advisory, **no code change**: answer inline with `-fp-mode precise` + escalate the **maintainer design question** — *"should DEFAULT permit result-changing reassociation, or only FMA contraction?"* Approaches B/C both change all-SPIR-V default codegen and would revise #11933 → **maintainer call, NOT an auto-patch**.

## Chain state (as of 2026-07-19)
- Triager POSTED verified 5-bullet verdict (issue comment **5017829442**), applied `reproduced` label + Type=Bug.
- Triager POSTED design-escalation as a **fresh** comment (**5017842117**), @-mentioning **`jkwak-work`** — question verbatim: *"Should DEFAULT `-fp-mode` permit result-changing reassociation (current), or be restricted to FMA-only contraction?"* with keep-as-designed / restrict-and-revise-#11933 paths + note reporter is unblocked by `-fp-mode precise`.
- Fixer stood down (no code change — correct).
- **#12160 OPEN, no PR (design-gated, correct).** Awaiting `jkwak-work` reply → arrives as webhook inbound on this thread → **triager re-engages** (owns the chain).
- **GUARDRAIL (Main):** design-gated. Any change to DEFAULT fp-mode / #11933 = jkwak-work (fp-mode owner) / human maintainer decision. Drafts-only for any fix PR. Triager owns forward; I do not post on its behalf.

## Handle correction
fp-mode owner's GitHub login is **`jkwak-work`** (verified assignee of #11933), NOT `jkwak-nv` (invalid login). See [[reference_slang_maintainer_handles]].

Related: [[project_12141_vector4_disable_vec2_scalar_init]] (-Wno/default-behavior gate), #11933 fp-mode NoContraction design.
