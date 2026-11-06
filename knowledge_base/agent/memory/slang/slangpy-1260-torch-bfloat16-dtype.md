---
type: chain
title: slangpy#1260 — PyTorch bridge rejects torch.bfloat16 tensors
description: Human-filed (tekintatar) 2026-11-04 22:35Z. torch.bfloat16 missing from the torch dtype tables, and SGL ScalarType/DataType have no bfloat16. Triaged + reproduced on L40S 11-05; slangpy-fixer owns Approach A on fix/issue-1260.
tags: [slangpy, torch-integration, bfloat16, dtype, reflection]
resource: raw/slangpy-1260-triage-memo.md
---

# slangpy#1260 — torch.bfloat16 unsupported in the torch bridge

- **Filed** 2026-11-04 22:35Z by tekintatar (human, external). No labels, no assignee. R6: no hold.
- **Dispatch:** the 22:35Z `issue_opened` turn died in the gateway 500/503 wave (22:39–22:46Z). Supervisor tick 326
  re-raised it. Dispatched slangpy-triager 11-05 00:18Z (session `sess-1793837912159-6y7ocu`, thread
  `gh-issue-shader-slang/slangpy-1260`). `grep 1260 memory/slang/` had only numeric false hits.
- **Triage (00:36Z), the triager's finding:** reproduced on L40S CUDA, main 68d1e782, Slang 2026.20. Enhancement + latent bug,
  medium, P2. The cause is the reporter's, but their fix is incomplete. SGL `ScalarType` ends at `uintptr`=15/`COUNT`=16, and Slang BFLOAT16 = 16,
  so the nanobind enum rejects every bf16 reflection read. Also needs `slangpytorchtensor.cpp:719`, `type.cpp:144`, `func/tensor.cpp:17`.
  Approach A (first-class `bfloat16`) recommended. I checked the enum at 68d1e78 myself. Triage comment 6646245692 is posted by
  nv-slang-bot (checked). Memo: [raw/slangpy-1260-triage-memo.md](raw/slangpy-1260-triage-memo.md).
- **Latent side defect:** the `slangpy_ext/device/cursor_utils.h` `[COUNT]` converter tables are indexed with no bounds check
  (Slang scalar ≥16 reads OOB). The triager recommends a separate PR with no `Fixes #1260`. Not yet assigned to anyone.
- **Fixer:** the triager handed off directly. slangpy-fixer session `sess-1793838906690-kxnlld` acked 00:35Z, branch `fix/issue-1260`.
  The maintainer gate is the draft PR (owner ccummingsNV). The ready-flip goes on the weekly list (not P0/P1).
- **Fixer progress (11-05, the fixer's report):** 00:46Z codex approved the plan (R2). 00:50Z committed tests, 17 failing on baseline; the fix touches 8 files.
  01:03Z found a 2nd bug: the fallback bridge's bf16 CUDA-array-interface typestr `<V2` is rejected by `torch.as_tensor` on the Vulkan
  interop copy path, so it is fixed and has a unit test. 01:08Z: torch/dtype suites pass on CUDA + Vulkan (837 passed), and the reporter's script prints `bfloat16: OK`
  on both bridges. The full suite + C++ unit tests were running. There was no PR yet.
- **PR [#1261](https://github.com/shader-slang/slangpy/pull/1261)** opened as a draft 11-05 01:25Z by nv-slang-bot, head `fix/issue-1260`, 15 files, closes #1260 (verified).
  pr-mapping → slangpy-fixer `sess-1793838906690-kxnlld` (verified). The fixer reports the full suite had 4641 passed; it says the 50 Py + 11 C++ failures
  are only Git LFS pointer images missing in its container (unverified; CI is the check). Next: explanation comment, then peer review. The ready-flip goes on the weekly list.
- **Cursor side-PR:** at 01:37Z the fixer acked that the `cursor_utils.h` `[COUNT]` bounds guard ships as its own draft PR, based on main, with no closing keyword. That side-find now has an owner.
- **Review R1 (01:55Z, slangpy-reviewer `sess-1793842591804-si0xed`): REQUEST_CHANGES @`4d0592d0`.** The fixer received it (its in-rows 18/20, checked).
  The reviewer's findings: B1 `test_bfloat16_tensor_write[*-vulkan]` fails Windows CI (run 41948449555, both jobs). The Windows driver rounds
  float→bf16 toward zero, the test expects RNE, and the fix is bf16-exact inputs. The product code is correct. G1: list bf16 autograd as out of scope (Slang `BFloat16` is not
  IDifferentiable). G2: fallback auto-alloc output untested. Memo: [raw/slangpy-1261-r1-review.md](raw/slangpy-1261-r1-review.md).
- **Watch items (no dispatch yet; the chain owns them, per the #14282 precedent of reviewer → fixer → triager files):**
  (a) the reviewer's unrelated find on main: `[Differentiable] half f(half x)` autograd **segfaults on Vulkan** (`autogradhook.py:85`) and gives `grad=None` on CUDA.
  It's a separate-issue candidate; check that someone filed it when R2 lands. (b) Q2 `escalate-to-slang`: Slang emitting RTE for `BFloat16(float)` on SPIR-V
  is a scope question, not a verified bug, so it goes to the operator if pursued. (c) Q1: the `spvBFloat16KHR` profile-upgrade warning (`compiler_target.cpp:192+`) is a possible slangpy follow-up.
- **R1 fixes pushed (11-05 02:03Z) as `bee91422`.** The write test now uses bf16-exact inputs, the output test runs under both bridges, and to_numpy is ungated + `RuntimeError`. R2 was requested 02:12Z. Windows CI was still pending.
- **Side-find dispatch (02:13Z; I made the call when the fixer handed both over):**
  (a) bf16 SPIR-V rounding → slang-triager `sess-1793844781791-yshbiv`, thread `side-find-slangpy-1261-bf16-spirv-rounding`. Rule: if Slang defines RNE and SPIR-V has no
  RTE decoration, file on slang; if the semantics are undefined, don't file, report the facts, and I take it to the operator.
  (b) half→half autograd Vulkan segfault → slangpy-triager #1260 session (`…6y7ocu`, pin + in_reply_to=2; landed, acked 02:13Z). The triager dedupes, reproduces and files, with no fixer yet.
  The new issue's `issue_opened` webhooks need **no dispatch**: they are chain-owned side-finds.
- **(a) outcome (02:22Z, slang-triager's report): NOT FILED, a design question.** Every narrowing `OpFConvert` (half, bf16, float←double) is bare, with no
  FPRoundingMode. Slang docs/spec define no rounding. skallweitNV already accepted Vulkan RTZ for `half` in slang#13485 (test moved to CPU/CUDA).
  The Vulkan spec says RTE/RTZ execution modes don't apply to BFloat16KHR, and the L40S ignores an explicit RTZ decoration on bf16. Constant folding is RNE, and the
  `slang-math.h:212` comment claiming it "agrees with runtime narrowing" is false on Vulkan. Sent to the operator as an FYI (default: no design issue).
  Also noted: HLSL/Metal emit an undeclared `BFloat16Type(...)`, and GLSL/C++ give E99999 on the bf16 conversion. I asked slang-triager to dedupe/file these as possible separate bugs.
- **HLSL/Metal/GLSL/C++ bf16 follow-up (02:24Z):** known as slang#14159 (same root cause: the `cuda_sm_*` [require] alias is cross-target). Nothing new filed.
  This exposed #14159's stale R6 hold, which I released (see [14159 record](14159-metal-bfloat16-fp8-undeclared-types.md)).
- **R2 (02:49Z): APPROVE @`bee91422`.** 0 open findings. CI is green (checked: 15 pass, 1 skipping/CodeRabbit), and both Windows jobs pass the bf16 Vulkan cases.
  Memo: [raw/slangpy-1261-r2-review.md](raw/slangpy-1261-r2-review.md). **State: review-complete draft, READY-FLIP PENDING (P2, weekly list; no per-PR ask).**
  Out-of-PR follow-ups: Slang RTE rounding (operator FYI, default not filed); bf16 IDifferentiable in Slang (unfiled);
  `spvBFloat16KHR` capability selection (unfiled); half-autograd segfault = slangpy#1262 (own chain).
- **[Fix Report] (02:54Z):** fixed. Draft #1261 @`bee91422`, 15 files (+171/−5), 4 commits. Board sync assigned jhelferty-nv and requested their review (the bot didn't).
  Issue 5-bullet 6647205635 updated. Next from the fixer: the cursor `[COUNT]` bounds-guard side PR (own draft, base main, no closing keyword;
  `slangpy_ext` `cursor_utils.h` + `sgl` `cursor_utils.cpp`). Not redirected. **Chain state: PARKED on human review / ready-flip.**
- **Cursor side PR (03:14Z, the fixer's finding):** reproduced on main: a BufferCursor write of `matrix<FloatE4M3|BFloat16,2,2>` segfaults (rc 139) and a read gives
  `bad_function_call`. Also `write_from_numpy` gives `bad_function_call` for in-range unsupported types (`vector<int16_t,2>`), because the numpy converter tables are never initialized.
  Codex approved the plan; tests and fix next. No PR number yet.
- **Side PR [#1264](https://github.com/shader-slang/slangpy/pull/1264)** "Bounds-check Slang scalar types in cursor converter tables". Opened as a draft 11-05 ~03:29Z by nv-slang-bot,
  head `fix/issue-1260-cursor-bounds` @`31911de`, 3 files, no closing issue (checked). pr-mapping → the same fixer session `…kxnlld` (checked). The explanation comment is sent; peer review is next.
- **#1264 R1 (03:48Z): APPROVE_WITH_NITS @`31911de8`.** 0 bugs or gaps, 2 nits. CI green (checked: 15 pass, 1 skipping). It merges cleanly with #1261 (878 passed).
  On main the reviewer saw 34/80 fail and the fixer reported 38/80; both agree all 80 pass with the fix. Memo: [raw/slangpy-1264-r1-review.md](raw/slangpy-1264-r1-review.md).
  Next: the fixer applies the nits. Then **READY-FLIP PENDING** (weekly list), like #1261.
- **[Triage Resolution] (03:51Z, slangpy-triager):** fixed in draft #1261. Triager delta issuecomment-6649179125 links #1264 and #1262. The #1260 triage arm is closed.
- **#1264 final (03:56Z, triager's report):** head `42d07987` (test IDs only; N1 applied, N2 optional), 3 files +104/−16. CI pending at that head, green at `31911de8`.
  Shepherd kaizhangNV was auto-requested. Merges in either order with #1261. **Both #1261 and #1264 are READY-FLIP PENDING (weekly list).**
  Watch: if #1264's body is edited or the PR leaves draft, re-check it still closes nothing.
