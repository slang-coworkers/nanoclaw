---
type: chain
title: slang#14159 — Metal accepts BFloat16 / FloatE4M3 / FloatE5M2 and emits undeclared `*Type` names
description: Human-filed (albertrodriguezclo, external) 2026-11-02 10:04:36Z. On -target metal the three types pass the capability check and emit BFloat16Type/FloatE4M3Type/FloatE5M2Type (undeclared in MSL). Expected - BFloat16 -> MSL `bfloat` gated on metallib_3_1, or a capability error; FP8 -> capability error. Triaged 11-02 10:50Z bug/medium/P2: the cuda_sm_* [require] lanes are cross-target aliases, so the types are legal everywhere. PARKED on R6 (triager one-shot i14159-r6-release-7343, 11-06 10:05Z) + the maintainers' option choice. The reporter owns the PR; no bot fixer.
tags: [metal, capabilities, bfloat16, fp8, r6, triage]
---

# slang#14159 — Metal BFloat16 / FP8 emit undeclared MSL type names

**Report.** `BFloat16`, `FloatE4M3`, `FloatE5M2` compile on Metal with no diagnostic and emit
`BFloat16Type(...)` / `FloatE4M3Type(...)`, which Apple `metal -std=metal3.1` rejects as undeclared.
MSL 3.1+ has native `bfloat`; MSL has no 8-bit float. Affected repo tests: `tests/hlsl-intrinsic/scalar-bf16.slang`,
`scalar-fp8.slang` (vk/cuda lanes only), `substandard-fp-folding.slang`. Master `6815ed82d`.

**Dedup (11-02 ~10:10Z).** `grep 14159 memory/slang/` hit only a digit string in #14062 (unrelated). No author PR
names it (author's open PRs #14147–#14150 are other topics). Same "passes the capability check on Metal" family
as #14014 (root cause there: stale capability read in `processReferencedDecl`, draft PR #14024) — Orchestrator's
note only; the triager decides whether it is related.

**R6.** Human-filed, no labels, no crash word → hold until **2026-11-06T10:04:36Z**: no bot comment, PR, or commit
naming the issue before then.

**Ownership.** Webhook → Main `sess-1793613878546-utqk5q` → slang-triager on `gh-issue-shader-slang/slang-14159`.

**10:07Z triager ack (triager's finding, unverified).** Reproduced on master 6815ed82d (Metal rc=0). The triager also sees HLSL
emit the same undeclared names and GLSL/C++ internal errors, so the scope may be wider than Metal. It is researching the root cause and the
#14024 interaction. No GitHub writes (R6).

**10:09Z triager progress (triager's finding, unverified).** A user `[require(cuda_sm_8_0)]` struct or function also compiles on Metal
with no E36107, while `[require(spvBFloat16KHR)]` alone errors. The triager's working theory is a gap in the `cuda_sm_*` capdef definitions,
not #14014's stale read.

**Reporter comment 6574882621 (11-02, verbatim gist).** The reporter says the types carry `[require(spvBFloat16KHR)] [require(cuda_sm_8_0)]`
and `[require(spvFloat8EXT)] [require(cuda_sm_8_9)]` in core.meta.slang, but nothing enforces these on a use of the type. HLSL emits
the same names, GLSL gives E99999, and `-restrictive-capability-check` is silent. Options: (1) map BFloat16 to MSL `bfloat` with a
`metallib_3_1` requirement; (2) a Metal emitter diagnostic; (3) enforce `[require]` on intrinsic types in the capability check.
The reporter suggests 3 + 1 and asks maintainers which they prefer and whether BFloat16 should raise the Metal profile to 3.1. **The reporter offers to
prepare the PR**, so no bot fixer is expected. Not an @nv-slang-bot mention. Relayed to the triager on the canonical thread. R6 still holds.

**10:30Z triager (triager's finding, unverified).** On the PR #14024 build, the repro output is identical to master, so the
#14014 fix does not cover this issue. The triager is testing a scratch build of master plus a 3-line `[require]` edit to settle the reporter's claim against its own
`cuda_sm_*` alias finding. Full report to follow. The triager plans no bot fixer and no GitHub writes before the R6 release.

**10:42Z triager interim (triager's finding, unverified; scratch builds only).**
- The triager says the reporter's premise is wrong. The checker already enforces a core type's `[require]` on use; the
  requirement set is too wide because of the `cuda_sm_*` alias. After narrowing to `[require(cuda, cuda_sm_8_x)]`, all three types give E36107 on
  metal/hlsl/wgsl/glsl/cpp, and cuda/spirv stay clean.
- The fix is 12 lines: the 3 type `[require]` lines plus 9 `CoopMat<BFloat16>` `[require]` lines in hlsl.meta.slang. Without the 9, the core module fails with 13
  E361xx errors. With all 12, the build is clean and none of the 18 bf16/fp8 test files changes status. Known gap: `CoopMat<FloatE4M3>` on HLSL cs_6_10
  (works today, untested) would now get E36107. The triager is testing a variant that keeps an `hlsl, sm_6_10` FP8 lane.
- Correction: the 10:09Z "reproduced on 6815ed82d" ran on a stale local binary (2026.13.1-50), not a HEAD build. A HEAD rebuild
  is running to confirm. The reporter's repro on 6815ed82d stands on its own.

**10:50Z [Triage] (final).** Bug/medium/frontend/P2. Not a regression: the bug dates from #9780, which added the types. Not a duplicate. Related: #10750 and #14014
(different root cause; #14024's head 99c736dba gives byte-identical output). Verified on a pristine HEAD 6815ed82d build: metal and hlsl return rc 0 with `BFloat16Type(...)`;
wgsl returns rc 0 and silently drops the conversion; glsl and cpp give E99999; spirv and cuda are OK.
- **Root cause (I spot-checked it in source at 6815ed82d).** core.meta.slang:1761/1777/1793 use `[require(cuda_sm_8_x)]`. The capdef chain `cuda_sm_8_9 → cuda_sm_8_0 →
  … → cuda_sm_2_0 = _cuda_sm_2_0 | cuda_sm_1_0 | sm_4_0` (capdef:2238) pulls in every target. Separate `[require]` attributes OR together, so each type is legal on all targets. The checker
  does enforce type `[require]`; the reporter's "nothing enforces" claim holds only for generic core intrinsic types (the #13616 exclusion).
- **Fix measured by the triager.** v2 changes 12 lines: the 3 types plus 9 `CoopMat<BFloat16>` methods at hlsl.meta.slang:32190-32409. Core and std modules build clean, and the
  bf16/fp8/coop-mat suites are unchanged (the 3 fp8-cuda INVALID_PTX failures predate the change). It breaks `CoopMat<FloatE4M3>` on hlsl cs_6_10, which is untested.
  v3 adds an `[require(hlsl, sm_6_10)]` FP8 lane and keeps that path, but scalar FP8 on hlsl is then accepted again (auto-raised to sm_6_10, still emits `FloatE4M3Type`). This trade-off is for maintainers.
- **Options.** Option 3 needs no checker change: the declaration fix gives its result. Option 1 is feasible (a `[require(metal, metallib_3_1)]` lane plus
  `requireMetalLanguageVersion(3,1)` and the emit cases). Option 2 is a consumer-side patch. The choice is the maintainers'.
- **Timer.** Triager one-shot `i14159-r6-release-7343` at 2026-11-06T10:05Z posts the triage comment (draft in the triager's workspace) and applies
  `reproduced` + Type=Bug unless a human has set them. Memo: `/workspace/inbox/a2a-1793616651187-9xdgmk/triage-14159.md`. Scratch: triager's `wt-14159` (v3, uncommitted).

**Resume on:** the R6 one-shot (11-06), the reporter's PR, or a maintainer comment answering the option question.

**2026-11-02 13:42Z, related bot filing [#14186](https://github.com/shader-slang/slang/issues/14186)** (WGSL half: `mat2x2<>` and
dropped scalar conversions; filed by the #13571 triager chain, which owns it). The 10:42Z v2 declaration fix gave E36107 on wgsl, so it
likely covers #14186 too. The 11-06 triage comment can name it.

**11-04 19:19Z: capdef detail (from slang-fixer on the #10232 chain; not posted anywhere).** Enforcing the type-level
`[require]` alone would not close this gap. `cuda_sm_8_0`/`cuda_sm_8_9` → `cuda_sm_6_0 = … | sm_4_1` (capdef:2284), and
`sm_4_1_version` lists `_sm_4_1` (HLSL), `metal` and `wgsl` (capdef:1759-1767), so these requirements are satisfied on
HLSL, Metal and WGSL anyway. Reproduced on master 3da6f63c0: HLSL exits 0 with undeclared `BFloat16Type`, and DXIL exits
255. WGSL is tracked by #14186. Whoever picks up option 3 needs this detail.

**2026-11-05 02:25Z: stale R6 hold released.** The 11-02 "R6 until 11-06" hold came from the stale 4-day rule (retired 11-02; R6 has
no waiting period, nanoclaw #1993). I found it through the slangpy#1261 bf16 side-find: a slang-triager session on `side-find-slangpy-1261-bf16-spirv-rounding`
re-checked on master 6b0467fb2 that HLSL/Metal still emit `BFloat16Type(...)` and GLSL/C++ still give E99999 (known: #14159, nothing new filed).
I relayed to the #14159 triager session `sess-1793613990718-e0dptt` (pin + in_reply_to=2; it acked at seq 27, checked) to refresh the draft (C++ case,
11-04 capdef detail, #14186), post it now with `reproduced` + Type=Bug, and cancel one-shot `i14159-r6-release-7343`. No bot fixer: the reporter owns the PR.

**2026-11-05 02:34Z: triage comment posted (verified live).** https://github.com/shader-slang/slang/issues/14159#issuecomment-6648117016.
Labels `reproduced` and Type=Bug are set; one-shot `i14159-r6-release-7343` is cancelled (the triager's report). The comment uses a fresh `6b0467fb2` build, gives the
capdef alias chain, the 12-line trial data, and #14186. It has no @-mentions and passed Codex OUTPUT_REVIEW. The issue has an assignee, jkwak-work (no comment yet).
**PARKED on the maintainer:** (a) BFloat16 on Metal (`metallib_3_1` + `bfloat`, or an error for now); (b) whether to keep HLSL SM 6.10 FP8 coop-mat.
The reporter owns the PR, so there is no bot fixer. The timer is the supervisor register (`awaiting_human`). **Resume on:** a maintainer or reporter comment, or the reporter's PR.

