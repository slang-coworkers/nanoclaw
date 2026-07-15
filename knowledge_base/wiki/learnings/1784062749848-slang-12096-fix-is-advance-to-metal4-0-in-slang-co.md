---
title: "slang#12096 fix is ADVANCE-to-metal4.0 in Slang-core (-std derivation), NOT slang-rhi retreat — my triage verdict was wrong"
type: learning
topic: slang-compiler
source: learnings/1784062749848-slang-12096-fix-is-advance-to-metal4-0-in-slang-co.md
---

# slang#12096 fix is ADVANCE-to-metal4.0 in Slang-core (-std derivation), NOT slang-rhi retreat — my triage verdict was wrong

**Correction to my own #12096 triage.** I recommended **Approach A in slang-rhi** — stop advertising `metallib_4_0` on macos-26 (retreat to 3.1) — premised on "the macos-26 toolchain LACKS metal4.0" and "slang core is correct, no core change." **Both premises were wrong**, falsified by the fix that actually landed on the linked #11999 (PR #12009, jkwak-authorized, verified green).

**The real fix (verified on branch `fix/issue-11999` commit `aba3cd7dd`):** the OPPOSITE philosophy — the RHI's per-OS 4.0 advertisement is *correct* (macos-26 genuinely supports Metal 4.0), and the defect was Slang's **downstream `-std=metal3.1` hardcode** rejecting its own correctly-emitted 4.0 attribute. Fix = a **SLANG-CORE change**:
- `source/compiler-core/slang-gcc-compiler-util.cpp:978-987` now emits `-std=metalX.Y` from `options.metalLanguageVersion` when set, else the historical `-std=metal3.1` (master still hardcodes 3.1 at line 973).
- Producer: `source/slang/slang-code-gen.cpp` sets `metalLanguageVersion = 4.0` when `getTargetCaps().implies(metallib_4_0)` — the same predicate the emitter uses, so emit-gate and downstream-std can't diverge.
- New `SemanticVersion metalLanguageVersion` field on `DownstreamCompileOptions` (`slang-downstream-compiler.h`).

**Why my premise was falsifiable and I missed it:** I asserted "toolchain lacks metal4.0" from the error text (`metal 32023.883 ... requires metal4.0 or higher`) without checking whether the toolchain would accept 4.0 *if invoked with `-std=metal4.0`*. It does — the green macos-26 run proves the compiler supports 4.0; it was only ever being told to target 3.1. **Lesson: an error "requires version X" is ambiguous between "toolchain can't do X" and "we didn't ask for X" — distinguish them before recommending a capability RETREAT. The fix that advances the request is often right where the retreat is wrong.** Also: "slang core is correct, no core change" — I verified the *emitter* was reactive/correct but never checked the *downstream-compile* layer (`-std` construction), which is also slang-core and was the actual bug site.

**Coverage nuance for calling it fixed:** #12009's green macOS jobs are `ci-slang-test`/`test-slang-rhi` + the re-enabled `gpu-printing` example on macos-latest — NOT the four `gfx-unit-test-tool/*Metal.internal` tests from #12096, which run in the **Nightly Slang Coverage Test** workflow that is STILL pinned to macos-15 (#12075). Same code path (compute→createComputePipeline→metal4.0) is exercised via gpu-printing, so it's strongly corroborated, but the four specific tests aren't directly confirmed on macos-26 until the #12075 pin is removed and the nightly runs green.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784062749848-slang-12096-fix-is-advance-to-metal4-0-in-slang-co.md`_
