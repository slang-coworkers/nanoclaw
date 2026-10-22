---
type: chain
title: slangpy#1232 — Vulkan module-level [[vk::push_constant]] → silent wrong functional-API results
description: Human-filed (albertrodriguezclo) 10-16. All coworker tiers closed. SlangPy part = slangpy#1235 (APPROVED, ready, behind main, awaits merge). Upstream = slang#13713 → slang#13724 (E39033, breaking, APPROVED 10-20; error vs warning open) + slang-rhi#915 (assigned to jkwak-work, Q4; ToT re-triage with slang-triager since 10-21). Open: merge #1235, maintainer on #13724, operator on rhi#810 / #915 / GLSL export follow-up.
resource: https://github.com/shader-slang/slangpy/issues/1232
---

# slangpy#1232 — module push constant + functional API on Vulkan

Reproduced by slangpy-triager on L40S (main b89a3827, Slang 2026.19, rhi e0eeb428); CUDA correct.
Memo: slangpy-triager FS `memory/triage/1232-vulkan-module-push-constant-silent-wrong.md`
(copy at `/workspace/inbox/a2a-1792164664476-3xgrrm/`); repros on triager FS `/workspace/agent/repro-1232/`.

Split by subtopic (2026-10-20 OKF fold):
- [[slangpy-1235-push-constant-fail-loudly-pr.md]] — the SlangPy-side PR, review rounds, merge state.
- [[slang-13724-multiple-push-constant-blocks-e39033.md]] — the upstream Slang diagnostic PR and its
  error-vs-warning question.

## Defects (slangpy-triager, corrected by slang-triager)
1. **slang-rhi** `addAllPushConstantRangesRec` (`vk-shader-object-layout.cpp:907-916`) lays the global
   block at 0 and EP call data at +16; Slang puts both at Offset 0 → shader reads the global's bytes
   (read 7.0 instead of 3.0). The rhi-only part is the overlapping `STAGE_ALL` ranges (VUID-00292).
2. **Slang**: an EP reading both blocks emits two PushConstant interfaces → spirv-val
   `VUID-StandaloneSpirv-OpEntryPoint-06674`, slangc exit 0, no diagnostic. **Slang owns the contract**:
   reflection gives PCB index 0/1 from a program-wide counter with no byte meaning, both at Offset 0, and
   `isParameterLocationUsed(PUSH_CONSTANT_BUFFER)` is false for every index — rhi cannot derive offsets.
   Not a dup of slang#9643, #7151, #5685.
3. **ParameterBlock path** = the slang#12349 mechanism; slang-rhi#810 fixes it (triager verified, then
   reverted). See [[project_slang_12349_vulkan_pb_pushconstant_pipeline_layout]]. The oversize
   (260 > 256) case is not silent under render-test (rhi's size check fires).

## Routing and threads
- SlangPy: slangpy-fixer, branch `fix/issue-1232`, thread `gh-issue-shader-slang/slangpy-1232`;
  triager owner session `j19ne3`. Triage cmt 6218899535 (edited in place).
- Upstream: slang-triager filed **slang#13713** (cmt 6219628228) and **slang-rhi#915** on ONE thread
  `gh-issue-shader-slang/slangpy-1232/upstream-slang`; slang-fixer owns #13713 on
  `gh-issue-shader-slang/slang-13713`, owner session `sess-1792167153964-gl1h7u`. **Replies to slang-fixer
  about #13713: owner-pinned, on the canonical thread** — a reply on the `…/upstream-slang` thread minted
  phantom session `nt0ivf` on 10-16 ([[feedback_a_thread_id_on_a_message_tag_loses_to_your_own_session_thread]]).

## Current state (2026-10-20 15:00Z re-check)
- #1235: unchanged since 10-19: APPROVED (ccummingsNV), ready, `behind` main, head `52e815d6`. Awaits a
  maintainer merge; `Fixes shader-slang/slangpy#1232` auto-closes the issue.
- #13724: **APPROVED by jkwak-work 10-20 14:08Z** at `ee9df255`. Every test job in PR CI run 39359079741
  passed; only its Falcor gate was cancelled 14:06Z. Falcor test is still running in dispatch run
  39359074408. 10 behind master; error vs warning still unanswered (fixer asked in cmt 6292930362).
- slang-rhi#915: **assigned to jkwak-work** (by jhelferty-nv 10-19 17:45Z), type Bug, milestone Q4 2026.
- slang-rhi#810: still DRAFT, `dirty`, no activity since 08-05.
- No nudges were needed: both fixers have PRs. The operator decisions were raised one last time to the
  dashboard at 10-20 ~15:04Z (msg 23). **Do not re-raise them on this chain;** wait for an operator reply or
  for webhooks (merges, maintainer answer). No re-check timer was set.

## Open human decisions
- Merge #1235 (maintainer).
- Error vs warning on #13724 (kaizhangNV / jkwak-work; same open question as #13518 Q1 on #13541).
- Operator: slang-rhi#810 promotion (still DRAFT, last updated 08-05, kaizhangNV); fix #915 `STAGE_ALL`
  overlap now; whether to file the GLSL uncalled-`export`-fn follow-up.
- One-shot re-check `rechase-1232-upstream-4666` ran 10-20 15:00Z (done). Recommended for #915: leave it to
  the assignee (jkwak-work).

## 2026-10-21: jkwak-work asks for a ToT re-triage of slang-rhi#915
jkwak-work on #915 (cmt 6320216701, 15:51Z) expects that the case now hits an error, because slang#13724 (E39033) merged 10-20 22:20Z as `69ad6c11`. I posted 👀 and TODO cmt **6320398694**. I dispatched to slang-triager with post authorization, pinned to owner session `6lzbb3` on `gh-issue-shader-slang/slangpy-1232/upstream-slang`, and it acked at 16:00Z. Its brief asks what slang-rhi still has to fix on its own side (`STAGE_ALL` overlap; EP block at +16 when the global is unused). It does not close the issue; the assignee does. The triager's report comes back to the #915 Main session (`1wj2d7`).
