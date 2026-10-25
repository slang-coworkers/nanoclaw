---
type: chain
title: slang#13767 — WGSL `[numthreads]` with a specialization constant → `override` in `@workgroup_size`
description: "External (albertrodriguezclo) 10-20 12:49Z feature request (E55205 on WGSL). Triaged 13:15Z (cmt 6291722864, reproduced, P2). jkwak-work GO 'let's go with A' 10-21 16:22Z (also self-assigned, WebGPU, Q4 milestone, Type→Bug). DRAFT PR #13826 (fixer sess kclwp6, pr-mapped). R1 @eda0728 REQUEST_CHANGES (V1: reused WorkgroupSize() emits WGSL const-of-override); V1 one-liner = the same isStaticConst line as draft #13816 (#13635), folded into #13826. Triage Resolution 10-21 22:59Z; PARKED on jkwak-work review + falcor-ci CI approval; Main recheck 10-24 16:00Z found no change."
tags: [slang, wgsl, spec-constant, numthreads, workgroup-size, triage]
---

# slang#13767 — WGSL: specialization constant in `[numthreads]`

**Sessions (canonical thread `gh-issue-shader-slang/slang-13767`):** Main `irc94k`, triager
`68uk9o`, fixer `kclwp6` (PR #13826 pr-mapping owner), reviewer `clbbmn`.

## Timeline (verified receipts)

- **10-20 12:49Z** `issue_opened`, albertrodriguezclo (author_association NONE). The live body matched the payload, and searches found no duplicate. Dispatched to the triager. The R6 human-issue wait gate (nanoclaw#1993) was still a draft, so it did not apply.
- **10-20 13:15Z** triage comment 6291722864. The triager set Type=Feature and the `reproduced` label. Approach A: the WGSL emitter prints the override name for each spec-const axis (3-arg `getComputeThreadGroupSize`, as GLSL does), plus an `int` cast in `materializeGetWorkGroupSize`. Parked, waiting on a maintainer. One-shot task `t-a5a458`.
- **10-20 15:33Z** reporter comment 6294636782: endorses A and rejects C (generic entry = one module per size). No bot reply.
- **10-21 16:08–16:22Z** jkwak-work (MEMBER) self-assigned, added `WebGPU`, set milestone Q4 2026 (Fall), and changed Type from Feature to Bug. Comment 6320905730: "@nv-slang-bot let's go with A". Relayed to the triager with `<github-post-authorized />`. Triager delta comment 6321261525. Handed off to the fixer.
- **10-21 ~18:57Z** **draft PR #13826**, `fix/issue-13767`, `Fixes #13767`, `pr: non-breaking`, 9 files. Upstream CI run 39657811749 was `waiting` at head eda0728.
- **10-21 20:47Z** reviewer R1 @ eda0728 **REQUEST_CHANGES**, 0 bugs / 4 gaps. **V1**: when one entry point reuses a whole `WorkgroupSize()` vector with a spec-const axis, the output is `const _S1 = vec3<i32>(i32(kX_0),…)` and Dawn rejects it. The case is new in the PR, because master stops at E55205. Remedy: `if (isSpecConstRateType(inst->getFullType())) return false;` at the top of `isStaticConst`, plus a pinning test. I checked the #13816 diff (fix/issue-13635): it has the identical line. ⇒ the side bug is **not filed** (it would duplicate #13816), and V1 is **folded into #13826** (triager msg 52). Expect a trivial rebase conflict between #13826 and #13816.

- **10-21 22:32Z** reviewer R2 @ f28a817 **APPROVE_WITH_NITS** 0/0/0 (13 files). The reviewer reports V1 closed (drill + GPU), the R1 gaps closed, and maintainer requirements R1–R6 met. 3 comment/assert nits go to the fixer with no re-review: C001 cite the producer shape at `slang-ir-collect-global-uniforms.cpp:332-339`; C003 fail loudly on the non-u32 `else`; FG011 present-tense test headers. Local suite 10317/10335, pre-existing failures only. Upstream CI 39677273904 `waiting` @ f28a817 (I checked). Still a draft.

- **10-21 22:59Z** triager `[Triage Resolution]`. I checked live: draft #13826 @ a7070462d4, 14 files +475/−20, closes #13767, `pr: non-breaking`. The R2 nits are applied. Upstream CI 39688261676 is `waiting` (falcor-ci approval / bot-priority yield). Newest issue comment 6324249050 (fixer, 19:07Z) already says "Human review on #13826". The triager cancelled `t-a5a458`, and its tier is closed.

## Operator decisions

- File the `materializeGetWorkGroupSize` int3-cast bug separately? **Moot.** #13826 fixes it.
- File the `isStaticConst` const-of-override bug separately? **Moot.** It duplicates #13816.
- C001's producer follow-up (`collectGlobalUniformParameters` keeps a removed-param use until a later E55205): a separate change; filing needs a **GO**.
- CUDA follow-up (reviewer R1 observation, pre-existing on base and head): with a spec-const `[numthreads]` plus `WorkgroupSize()`, CUDA emits `make_int3(_S1, …)` with `_S1` never declared, so nvrtc fails, and no E55205 is reported. Filing needs a **GO**.
- Reviewer ask #5 (GLSL `local_size_x = 4u` is not int, `slang-check-modifier.cpp:2329`, a pre-existing bug): a follow-up issue needs an operator **GO**. Not filed.

## Next

**PARKED** on jkwak-work review + ready flip, and on upstream CI (falcor-ci approval).

- **10-24 16:00Z** Main one-shot re-check `recheck-13767-pr13826-b433`: **unchanged**. Still a draft @ a7070462d4, 0 reviews, 0 inline comments; the newest issue comment is still 6324249050 (10-21 19:07Z). CI 39688261676 is still `waiting`. I sent one line to the dashboard (thread `gh-issue-shader-slang/slang-13767`) naming the blockers and the 3 pending filing GOs. I did not ping jkwak-work. No further one-shot was scheduled, because the chain is in the supervise-issues register (`awaiting_human`), which serves as its timer. Fixer `kclwp6` owns the PR, so route every PR event to that session.
