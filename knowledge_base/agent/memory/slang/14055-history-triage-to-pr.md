---
type: chain-log
title: slang#14055 — dated history
description: Dated readings of the #14055 chain (10-29 triage, 10-30 local fix A + retired R6 timers, side-find dedupes and the held list, 11-02 timer stand-down override, comment + draft PR #14203 + filings #14205–#14208, 11-03 [Triage Resolution]); current state lives in the chain record, new dated entries append here
---

# slang#14055 — dated history

Chain record (bug, cause, current state, binding decisions): [[slang/14055-parser-multiply-deref-pointer.md]].
New dated entries go **here**, one section each. When this file nears 16 KB, prune the oldest superseded entries.
Numbers are the coworker's own unless marked verified. ⛔ Entries dated ≤ 11-02 describe the retired 4-day R6 hold; never copy that pattern.

## 10-30 06:0xZ: state under the (retired) R6 hold

| item | state |
|---|---|
| GitHub | no labels, 0 comments. **R6 hold: no bot comment, push, commit or PR naming #14055 before 2026-11-02 21:51:29Z** (human-filed, fence but no crash word, no `bot-ok`) |
| Fix | `fix/issue-14055`, 2 commits on 977df1246, unpushed; the commit messages do not mention #14055 |
| Triager timer | `t-766555` 11-02 21:52Z: posts the 5-bullet, adds `reproduced` + `regression` + Type=Bug (P1, so no P2 rationale) |
| Fixer timer | `slang-14055-r6-push-2eff` 11-02 22:00Z: pushes and opens the draft PR |
| Stand-down (both) | a human comment (the reporter counts), an assignee, a human/draft PR, a cross-ref/`connected` link, GoodFirstBug/HelpWanted/no-bot, or a fetch error |

To audit a timer: `ncl sessions list --thread-id system:tasks:<series>` (a `[]` does not prove absence).
Triager owner session: `1k60r3` (pin with `in_reply_to=2`).

## 10-29 / 10-30: Main decisions

- **10-29, #14037 pattern:** hand off now, fix A local-only; triager posts after the lift, fixer pushes after.
- **10-30, #13435 precedent for side finds:** the triager dedups each and files only non-duplicates as bot
  issues, with **no #14055 reference before the R6 lift** (a cross-ref is a timeline event). Their
  `issue_opened` webhooks are owned from this chain and need no dispatch.
- **10-30 ~05:00Z fan-out question** (dashboard msg 129, 7-row table): 6 bot issues and 3 drafts (#14090 followed) — keep
  filing deduped side finds, or cap? **Default until answered: HOLD new filings.** The triager keeps a held
  list (`memory/scratch/held-side-finds-14055-chain.md` in its group); all 5 fixer sessions were told.

## 10-30: side finds that needed no new issue (dedupes)

- HLSL E99999 → dup #13632 (draft PR #13856 E55219, and #13652, both unmerged).
- SPIR-V `__getAddress` OpStore mismatch → dup #13418 (bot, assigned jhelferty-nv, awaiting_human). Main OK'd
  ONE comment with 3 more shapes (a `RWStructuredBuffer<int*>` element, a local `int* p` then `buf[0] = p`,
  `*out = …` through `uniform int**`); relayed 00:53Z to triager owner `sess-1793273625935-bb46pw`, pinned
  `in_reply_to=2`, landed at its seq 6.
- WGSL hang → dup #12498. Trigger: a non-entry helper that *returns one of its pointer params* (`return x;`,
  `c ? a : b`; `return x + i;` finishes). v2025.18.2 OK, v2025.19+ hangs, exposed by #8668 (e420f2f98,
  `specializeAddressSpaceForWGSL`); `newWorkList` at slang-ir-specialize-address-space.cpp:700 is never
  cleared. Posted 00:56Z (comment 6512223455), pointing at open PR #13151 by jvepsalainen-nv ("Reset
  address-space fixpoint worklist each round", idle since 10-09). Stalled bot PR #12563 was not split.

## 10-30: held list (released 11-02; filed as #14205–#14208, H2 never filed)

1. render-test ignores `-entry` (`tools/render-test/options.cpp:301-303` parses it; `slang-support.cpp:22,802`
   hard-codes computeMain). All 194 `-entry` rows (66 files) use `computeMain`, so none is vacuous today; the
   trap hits only new rows with another name (it hit #14080 R1 G1).
2. Direct SPIR-V zero-extends a narrow signed `CastIntToPtr` — marked not-to-file.
3. GLSL `bit_cast<uintptr_t/intptr_t>(double)` → E99999 (no IntPtr/UIntPtr arm in the #14084 switch; SPIR-V
   siblings #8480/PR #13201, #13200/PR #13202). A natural extension of #14085 if allowed.
4. Direct SPIR-V null Workgroup ptr → `processPtrLit` (spirv-legalize:2122) → `OpConvertUToPtr`, rejected by
   spirv-val, with or without `-g`; a logical null needs `OpConstantNull`.
5. `*(int*)(v + 1)` on a `uniform void* v`, direct SPIR-V, SIGSEGVs the Vulkan test server (spirv-val
   accepts; driver or render-test suspected).

## 11-02 pre-timer check (live, 17:4xZ)

- #14055 has 0 comments and an empty timeline, and no PR mentions it, so no stand-down condition is met.
- The task lanes `system:tasks:t-766555` (triager) and `system:tasks:slang-14055-r6-push-2eff` (fixer) exist and are waiting.
- **No operator answer to the fan-out question.** I searched the dashboard session from seq ~509172 to 510170. The hold stays, and I re-asked once on 11-02.
  The hold is local to this chain: other Main sessions filed side finds freely on 10-31 to 11-02 (#14116/#14117/#14130/#14192, rhi#960).

## 11-02 21:54Z: timer stood down; Main overrode it

- t-766555 stood down on condition (b), an assignee: **jhelferty-nv assigned jkwak-work at 18:40:38Z**. Nothing was posted. The fixer's 22:00Z timer stands down on the same check.
- ⛔ **That condition came from the STALE 4-day R6 rule** (see the Core Memory R6 line). nanoclaw #1993 merged 10-25 with no wait. A stand-down now needs an **explicit human request** (szihs on #13596, 11-02 12:30Z). An assignment is not one; it looks like the shepherd assignment, since jkwak-work also shepherded and approved #14090 that day.
- **Main 11-02 ~21:5xZ: proceed.** The triager posts the triage comment (offering the draft PR; the assignee may take it over or close it) plus `reproduced` + `regression` + Type=Bug. The fixer merges master, re-runs in the CI env, and opens a draft PR with `Fixes #14055`, then calls report_pr_created and requests peer review. Stop at once on any explicit stand-down request.
- **The fan-out question was moot.** My own 10-31 filing policy ([[../orchestrator/filing-verified-issues-policy.md]]) already says reproduced, deduped bugs are filed without asking.
  The held list is released: file H1, H3 and H4 as filed-only (no fixer chains); H5 only if it reproduces in an isolated run; H2 is never filed. I withdrew the question on the dashboard.

## 11-02 22:1xZ: posted and filed (verified on GitHub by Main)

- Triage comment **6589471730** (21:56:40Z), labels `reproduced` + `regression`. Assignee jkwak-work is offered the PR.
- Draft PR **#14203** (`fix/issue-14055` @ c91a9fd, `Fixes #14055`, `pr: non-breaking`, 22:08:56Z). Mapped to fixer session `dxst43`.
- Side finds were filed filed-only (no fixer chain) and re-verified on master 9b46bca64: **#14205** (H1 render-test `-entry`), **#14206** (H3 GLSL bit_cast intptr), **#14207** (H4 SPIR-V null Workgroup ptr), **#14208** (H5 NVIDIA driver crash at pipeline creation; it reproduced in isolation). H2 was not filed. Their `issue_opened` webhooks need no dispatch.
- 11-04/11-05 maintainer and operator activity on #14205–#14208 lives in [[slang/14205-14208-pointer-side-finds-filed-only.md]].

## 11-03 02:42Z: [Triage Resolution], with the triage side closed

- **#14203 head 5872fb173** (I verified it: still a draft). Review: R1 REQUEST_CHANGES (small) → **R2 APPROVE_WITH_NITS**, with the remedy and N6–N13 applied.
- It differs from the brief: a run of 2+ `*` before `(` asks `_mayNameType` about the left operand. So `a * *(p + 1)`, `h.k * *(p + 1)` and `p->k` multiply, while `int**(p)` and `ns.T**(p)` stay casts.
- Tests (validated CI env, the fixer's numbers): 3/3 on cpu/vk/cuda; full suite 11414/11417 (3 known fp8-cuda).
- Comment 6589471730 was refreshed in place. No human comments or reviews and no `no-bot` label.

