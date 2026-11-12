---
type: chain
title: slang#14451 — [SPIR-V] integer mad() emits GLSL.std.450 Fma (invalid for integer result types)
description: Human (Guo-Haowei) 11-11 06:09Z, no labels/assignees. `mad<uint>(a,b,c)` lowers to `OpExtInst %uint Fma`, which spirv-val/spirv-opt reject; expected OpIMul+OpIAdd. TRIAGED 06:17Z bug/medium/P2 (SPIR-V, GLSL, CUDA, CPU broken; HLSL fine). **Draft PR #14452** (fb3d9dc745) R1 APPROVE_WITH_NITS applied; RESTING on maintainer review (jhelferty-nv assigned + requested); ready-flip pending (weekly list). Side issue #14454 (Metal/WGSL integer mad E36107) is filed only, with no chain.
resource: raw/triage-14451.md
tags: [spirv, intrinsics, mad, fma, hlsl-meta, dispatched, draft-pr, ready-flip-pending]
---

# slang#14451 — integer `mad()` emits `GLSL.std.450 Fma` on SPIR-V

**11-11 06:09Z `issue_opened`.** Author Guo-Haowei (human), 0 labels, 0 assignees, events API empty, 0 comments.
Slang 2026.17-25-gc7954ebd1, Windows. Memory grep: no prior chain. Dupe search: none. #13773 (open; float `fma`
emits non-fused GLSL Fma, SPV_KHR_fma) is related but distinct: float semantics, not integer validity.

**11-11 ~06:10Z** dispatched slang-triager, thread `gh-issue-shader-slang/slang-14451`.

**06:16Z triager interim (its finding, not yet verified by me):** reproduced on master `6862c98ec`. SPIR-V, GLSL, CUDA and CPU
are broken; HLSL is fine. The triager places the root cause in the integer `mad` in hlsl.meta.slang. It is now labeling, handing
off to slang-fixer, and posting on the issue. Next: verify its 5-bullet comment and the labels on GitHub when the [Report] arrives.

**06:17Z [Triage]**. I verified the GitHub side at 06:18Z: comment 6788639500 is by nv-slang-bot, the label is `reproduced`,
Type is Bug, and there are still no assignees. The rest is the triager's finding; the memo is in [raw/triage-14451.md](raw/triage-14451.md).
- bug / medium / P2. Not a regression: the float-only target arms date from the first integer `mad` (#2684). The overloads are at hlsl.meta.slang:13619-13666.
  - SPIR-V: Fma with an integer result; spirv-val rejects it for every int width and for vectors.
  - GLSL: `fma` is rejected by glslang.
  - CUDA/CPU: `$P_fma` expands to undefined `U32_fma`/`I64_fma`.
  - HLSL: UMad/IMad, which is correct. Metal/WGSL do not offer integer mad at all (E36107).
- Recommended fix **A**: drop the float-only arms so the default `m*a+b` covers every non-HLSL target. The vector default becomes the direct expression.
  - Rejected: B (duplicate the default), C (prelude-only helpers), D (emitter rewrite, which masks the producer).
- Judgment calls: the fix is scoped beyond SPIR-V to all 4 broken targets. Metal/WGSL enablement is optional and needs a test.
- Not dups: #13773 / PR #13779 (float fma arms only), #14061, #13983/#13988.
- Sessions: triager `sess-1794377438134-ozy7fv` (apezq5); fixer `sess-1794377790024-4adtai` (vmjrwe), both on the canonical thread.
Next: the fixer opens a draft PR. The triager waits for the [Fix Report] before posting its Triage Resolution.

**06:59Z triager [Report].** I verified it at 07:00Z.
- **Draft PR #14452** `fix/issue-14451`, head `7b69993b63`, `pr: non-breaking`, `Fixes #14451`, author nv-slang-bot.
  - Files: hlsl.meta.slang +1/−11 (Approach A: hlsl arm + default only) and new tests/hlsl-intrinsic/mad-integer.slang +152.
  - The pr-mapping goes to fixer `sess-1794377790024-4adtai` (vmjrwe), thread gh-issue-shader-slang/slang-14451.
- On the issue, fixer comment 6789305700 links the PR, and the triager edited triage comment 6788639500 in place to point at it.
- The fixer reports the test passes 10/10 on L40S (cpu, cuda, vk, vk-via-glsl, llvm) and fails 8/10 on master. That is its own claim.
- State: in peer review, no [Fix Report] yet. Once peer review completes, record it as ready-flip pending; it then joins the weekly list (11-16 run). No per-PR ask: P2, not a regression.

**07:53Z triager interim (its claim, not yet verified):** the [Fix Report] is in. PR #14452 got APPROVE_WITH_NITS, the nits are applied, and head is now `fb3d9dc`.
The triager is running its critique gate before the [Triage Resolution]. It is also filing the reviewer's side find, that integer `mad` is
unavailable on Metal/WGSL (E36107). Under filing-verified-issues-policy, a reproduced and deduped gap needs no operator ask, but a
fixer chain on it must be reported. Next: verify the new issue number, PR head and review, then mark PR #14452 ready-flip pending.

**08:01Z side-find filed as #14454** ("Integer mad() is unavailable on Metal and WGSL (E36107)"), by nv-slang-bot. I verified it at 08:02Z:
label `reproduced`, Type set, no assignees, open. The body says the fix is easiest after #14452 lands, since it touches the same two
overloads (widen `cpp_cuda_glsl_hlsl_spirv_llvm` to include metal/wgsl; drop the `shader5_sm_5_0` requirement once GLSL no longer emits `fma`).
**Owned by this chain, so its `issue_opened` needs no dispatch.** It is filed-only with no fixer for now. Decide fixer go/no-go after #14452 merges,
and report that fan-out when it happens (filing-verified-issues-policy). Next: the triager's [Triage Resolution] should name #14454.


**08:04Z [Triage Resolution].** I verified it at 08:05Z.
- PR #14452: draft, OPEN, head `fb3d9dc745`, 2 files +169/−11. jhelferty-nv is **assigned and review-requested**; there are no GitHub reviews yet.
  - Peer review (slang-reviewer R1) gave APPROVE_WITH_NITS with 0 bugs; the fixer applied G1, G2 and N1–N4. That is the triager's claim.
  - CI is draft-gated: run 42982625402 skipped every job, and the `wait-for-human-priority`/`check-ci` failures come from that gate.
  - The fixer reports the new test passes 10/10 on L40S and fails 8/10 on master. hlsl-intrinsic and glsl-intrinsic pass 946/946. The full suite is 12104/12107, and the 3 fp8-cuda failures also fail on master.
- Delta comment 6790509812 is posted on #14451, by nv-slang-bot at 08:01:53Z, and it links #14454.
- **Side issue #14454**: "Integer mad() is unavailable on Metal and WGSL (E36107), while float mad() compiles".
  - Filed by nv-slang-bot at 08:01:35Z; `reproduced`, Type=Bug, no assignees, no @-mentions.
  - **FILED-ONLY: no fixer chain.** It touches the same overloads, so it follows after #14452 lands.
  - If an `issue_opened` webhook arrives for #14454, it needs no dispatch; this chain owns it.
- **State: RESTING** on maintainer review (jhelferty-nv). **Ready-flip pending**: PR #14452 goes on the 11-16 weekly list. No per-PR ask: P2, not a regression.
- Owners: fixer `sess-1794377790024-4adtai` (vmjrwe) holds the pr-mapping; triager `sess-1794377438134-ozy7fv` (apezq5).
