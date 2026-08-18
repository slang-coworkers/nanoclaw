---
title: "slang#12258 re-triage — 'metallib_3_2 atom landed' actually meant PR #12250 rewired the whole Metal -std producer"
type: learning
topic: slang-compiler
source: learnings/1785463484364-slang-12258-re-triage-metallib-3-2-atom-landed-act.md
---

# slang#12258 re-triage — "metallib_3_2 atom landed" actually meant PR #12250 rewired the whole Metal -std producer

**Re-triage of #12258 (2026-07-31): maintainer jkwak said "re-triage because metallib_3_2 capability atom was added." Verifying at HEAD showed the atom was the SMALL part of what landed** — PR #12250 "Add Metal support for printf" (Lukas Lipp, 2026-07-30) also rewired the entire Metal `-std` version producer. Lesson: when a maintainer names one change to re-triage against, re-verify the whole subsystem at HEAD; the named change often rides in with a larger rework, and assuming "only the atom changed" would have produced a wrong residual-scope call.

**What #12250 landed (all verified @ HEAD dc9558d57):**
- `metallib_3_2` capdef atom (slang-capabilities.capdef:204, chain 3_1→3_2→4_0; `printf` alias :2473 gains it).
- Producer rewrite: slang-code-gen.cpp:786-804 no longer special-cases only metallib_4_0. It now maxes (a) `implies(metallib_4_0)→4.0` against (b) an emitter-tracked `MetalExtensionTracker::getRequiredMetalLanguageVersion()`. Emit features drive it: slang-emit-metal.cpp:909 calls `requireMetalLanguageVersion(SemanticVersion(3,2))` + `requireLogging()` for `kIROp_Printf`→`os_log_default.log`+`<metal_logging>`, which code-gen turns into `-std=metal3.2` + `-fmetal-enable-logging`.
- Toolchain-INDEPENDENT CI coverage: tools/slang-unit-test/unit-test-metal-compile-args.cpp asserts the assembled args (base→`-std=metal3.1`+no logging; printf→`-std=metal3.2`+logging) via `GCCDownstreamCompilerUtil::calcArgs` — no Apple toolchain needed. This is the pattern to verify `-std` selection without a device.

**The subtle residual gap (worth flagging, easy to miss):** the producer is now FEATURE-driven, not SELECTION-driven. `-capability metallib_3_2` ALONE (no 3.2 syntax in the shader) still emits `-std=metal3.1`, because the only capability branch is `if implies(metallib_4_0)` — there's no `else if implies(metallib_3_2)`. That's literally the issue's "pass -std=metal3.2 when 3.2 is selected" sub-task, still undone — but LATENT (no metal-3.2-only syntax exists today that isn't already feature-tracked, so no observable divergence). Whether to close it is a maintainer judgment call, not an obvious bug. Don't auto-dispatch a fixer for a latent gap on a maintainer-owned feature; surface it and ask.

**Disposition mechanics reaffirmed:** "re-triage because X landed" is an assessment request, NOT "make the PR" — don't auto-release the held fixer. And the infra-owned Bucket 2 (Windows Apple-Metal toolchain upgrade + Windows CI producing a real .metallib + docs) was untouched by #12250 (its own printf test deliberately skips the metallib run because no CI tier guarantees a ≥3.2 toolchain) — so the chain stays parked on Bucket 2 regardless of the small residual.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785463484364-slang-12258-re-triage-metallib-3-2-atom-landed-act.md`_
