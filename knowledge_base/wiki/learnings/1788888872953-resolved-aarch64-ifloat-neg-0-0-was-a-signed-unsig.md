---
title: "RESOLVED: aarch64 IFloat neg() 0/0 was a signed→unsigned cast bug, not emit divergence"
type: learning
topic: misc
source: learnings/1788888872953-resolved-aarch64-ifloat-neg-0-0-was-a-signed-unsig.md
---

# RESOLVED: aarch64 IFloat neg() 0/0 was a signed→unsigned cast bug, not emit divergence

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788286504789-4b2zz1
written_at: 2026-09-08T17:34:32.953Z
---

# RESOLVED: aarch64 IFloat neg() 0/0 was a signed→unsigned cast bug, not emit divergence

Resolution + correction to the earlier learning "Handling aarch64-only compiler miscompiles from an x86_64-only coworker" (shader-slang/slang#12871).

**The actual root cause (maintainer-found on physical aarch64 hardware):** a runtime signed-integer cast bug in the slangi VM interpreter. Both cast dispatchers in `source/slang/slang-vm-inst-impl.cpp` (`getCastHandler` at ~:916 and ~:962) mapped `kSlangByteCodeScalarTypeSignedInt` to an UNSIGNED C++ type — a copy-paste slip from the adjacent unsigned case. `static_cast<uint32_t>(-9.0f)` is undefined behavior (negative float → unsigned integer, out of range), so the two arches diverge: x86_64's `cvttss2si` happens to produce the correct bit pattern, while aarch64's `fcvtzu` saturates negatives to 0 → the observed `0 0`. The emitted byte-code is IDENTICAL across arches and the autodiff transform is correct. Fix: 8 lines, use signed C++ types for the signed case in both dispatchers.

**Reusable diagnostic signature — arch-divergent numeric result that is 0/garbage on ARM but correct on x86:** suspect a **float→unsigned (or negative→unsigned) cast** somewhere on the value path. It is UB, and the two ISAs' float-to-int convert instructions differ exactly here (x86 `cvttss2si` = signed-ish/accidentally-right; ARM `fcvtzu` = unsigned-saturating → 0 for negatives). This is a classic, easy-to-miss cross-arch bug; check the cast/convert handlers' signed-vs-unsigned type selection first.

**Method corrections to the prior learning:**
- The "leading hypothesis = aarch64 emit divergence" was WRONG. It was a runtime bug. When you can only test ONE arch, do not over-weight whichever hypothesis that arch's experiments happen to touch — the x86_64 poison/zero/disasm cleared the x86_64 emit AND runtime, which said nothing about aarch64 runtime. The codex-forced hedge "runtime not excluded" was the correct posture; honor it, don't quietly re-collapse to your favored branch.
- The handoff-to-aarch64-hardware move was VINDICATED: the maintainer with the box root-caused and verified it in a way the x86_64-only coworker provably could not. When you hit a genuine environment wall, a strong root-cause-direction writeup handed to someone with the hardware is a real outcome, not a failure — and it named the right suspect file (castHandler) even under the wrong emit/runtime weighting.
- Keyword lifecycle worked as intended: PR was `Fixes`→(unverified)→`Related to`→(maintainer-verified real fix)→`Fixes` again. Only carry `Fixes #N` once the fix is verified; the re-enabled known-red test going GREEN on the target-arch CI leg is the positive end-to-end proof.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1788888872953-resolved-aarch64-ifloat-neg-0-0-was-a-signed-unsig.md`_
