---
title: "[approver/challenger-miss] A macOS 'requires metal4.0' pipeline-creation failure can be a Slang emit/downstream-std bug, NOT the #11973 runner flake — don't collapse it to 'environmental'"
type: learning
topic: slang-compiler
source: learnings/1784083878096-approver-challenger-miss-a-macos-requires-metal4-0.md
---

# [approver/challenger-miss] A macOS "requires metal4.0" pipeline-creation failure can be a Slang emit/downstream-std bug, NOT the #11973 runner flake — don't collapse it to "environmental"

**Symptom:** On PR #12009 I decided ABSTAIN_POLICY/OPEN_GAP because the re-enabled gpu-printing example failed on macOS release with `kernels.slang(19): '[[required_threads_per_threadgroup(32,1,1)]]' requires Metal language standard metal4.0 or higher` → `failed to create compute pipeline` → exit 255. I attributed the red to the open+worsening runner-health flake #11973 ("Metal 4.0 attribute emitted vs sub-4.0 compile target" / `GPUFamilyApple6 not supported`). The abstain was CORRECT (PR was not mergeable as-is; a human had to look) — but my ROOT CAUSE was wrong.

**What it actually was (from the maintainer's merge commits):** A real Slang compiler bug, not an environment flake. The Metal emitter gates metal4.0-only syntax (`[[required_threads_per_threadgroup]]`) on the `metallib_4_0` capability, but the downstream metallib compile **hard-coded `-std=metal3.1`**. On a metal4.0-capable toolchain (macOS 26, where slang-rhi advertises `metallib_4_0`) the emitter emitted 4.0 syntax while instructing the compiler to compile as 3.1 → rejected. Fix (aba3cd7d, source/slang/slang-code-gen.cpp +slang-gcc-compiler-util.cpp): derive `-std=metalX.Y` from the same metallib capability the emitter honors. Maintainer jkwak-work then fixed it in-PR and merged at 2a6410d9 — my pinned 291f75b1 was NOT merged as-is.

**The miss:** Devin's narrative EXPLICITLY flagged the ambiguity — "We cannot decide 'hosted-Metal environment flake' versus 'slang-rhi robustness bug at the Metal boundary'" — and even said the #11973/#11999 narrative "pinned it on a createComputePipeline/metal4.0 signature that actually belongs to a different green gfx-unit-test." I read that, verified gpu-printing failed in its OWN kernel (correctly rebutting the "different test" point), but then still resolved the flake-vs-bug ambiguity toward "environmental #11973" — the comfortable prior — instead of "possible emit/toolchain-std bug." A capability-gated emit that mismatches the downstream `-std` is a *compiler* bug that presents identically to a runner flake.

**How to catch it next time:** When a Metal (or any target) pipeline/compile failure says `requires <lang-std> X.Y or higher` on syntax the Slang emitter chose, DON'T default to "runner/environment flake." Ask: does the emitter gate that syntax on a capability, and does the downstream compiler invocation pass a MATCHING `-std`/version? A version-gated emit paired with a hard-coded lower downstream std is a Slang bug. The `[Slang]: ERROR:` prefix (validation-forwarded) vs `[Driver]:` prefix in the log is a tell — a Slang-side emit/std mismatch surfaces as `[Slang]: ERROR: metal ...`, which is what #12009 showed. The abstain reason can stay OPEN_GAP either way, but the challenger writeup should name "possible emit/downstream-std capability mismatch" as a candidate root cause, not assert "environmental flake."

**Calibration:** vindicated abstain / AGREEMENT (human looked, found the real bug, fixed it, merged) — NOT a false-safe. Merging 291f75b1 as-is would have shipped a red example. The lesson is about *root-cause reasoning quality*, not the decision.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784083878096-approver-challenger-miss-a-macos-requires-metal4-0.md`_
