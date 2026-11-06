---
type: chain
title: slang#14305 — Vulkan negative physical-pointer arithmetic gives a +4 GB displacement on NVIDIA
description: Human (tdavidovicNV, repo admin) 2026-11-04 15:00:19Z, unassigned, no labels. Dispatched to slang-triager 11-04 on gh-issue-shader-slang/slang-14305. Reporter asks for maintainer investigation, NOT their prototype patch; no fixer chain without operator go-ahead.
tags: [spirv, vulkan, physical-storage-buffer, ptr-access-chain, 64bit-indexing, nvidia-driver]
---

# slang#14305 — `Ptr<uint>(base) + (-1)` → +4294967292 on NVIDIA Vulkan

**Ask (reporter's words).** "This is a request for maintainer investigation, not a proposed
compiler fix." The layer is open: driver, Slang lowering, or the Vulkan/SPIR-V contract.
"Neither the experimental lowering nor global extension enablement is being requested as the
predetermined solution."

**Reporter's evidence.** Windows, RTX 5090, driver 621.01, Slang `3da6f63c0ef`. SPIR-V keeps the
signed index (`OpPtrAccessChain`, `ArrayStride 4`) and validates. Same SPIR-V is correct with
`VK_PIPELINE_CREATE_2_64_BIT_INDEXING_BIT_EXT` or `[Shader64BitIndexing]`. Their prototype
(`emitGetOffsetPtr` → ConvertPtrToU / IMul / IAdd / ConvertUToPtr) fixes the isolated cases but
makes one combined shader hang in `vkCreateComputePipelines`; it also adds an Int64 requirement
and leaves unsigned-index semantics open. Related: #11538/#11541, #11967, #12081, #11990.

**Routing.** Author has `admin` permission but did not self-assign and asked for investigation,
so it is not a #14297-style hold. The canonical Main session is `sess-1793804426433-xsdkmz`.
No earlier chain (grep of memory/ for 14305: no hits).

## Log
- 11-04 ~15:05Z: dispatched slang-triager (thread `gh-issue-shader-slang/slang-14305`). New
  value asked for: a Linux / L40S / driver 595.91 GPU run, and an analysis of the spec reading.
  Post only new facts. Fixer = operator decision.
- 11-04 15:22Z: triager report (seq 10, memo seq 12 → `/workspace/inbox/a2a-1793805740371-ri7hku/triage-14305.md`).
  Triage comment 6634383096 (bot, 15:17Z), label `reproduced`. **Reproduced on L40S / Linux /
  595.91.07**, both in a ported host and in slang-test `-vk`. slang-rhi b856e635 never enables 64-bit
  indexing. lavapipe gives −4 with no opt-in. glslang lowers `p+i` to integer arithmetic. The spec
  does not say whether a negative total offset is sign-extended. Verdict: bug, layer unresolved,
  medium, P2. PARKED on maintainer decision; triager timer `i14305-recheck-1109` (session
  `system:tasks:i14305-recheck-1109-6104` verified to exist) fires 2026-11-09 15:00Z.
- Side bug D (I verified it in the source): core.meta.slang `operator-(Ptr, TInt)` =
  `__getOffsetPtr(value, -offset)` negates in the unsigned type, so on CUDA/CPU `p - uint(1)` moves
  +0xFFFFFFFF elements. I authorized the triager to dedupe and file it (no go-ahead is needed). A
  fixer chain for it is the operator's decision; the ask went to the dashboard. Side note E: GLSL
  emit of a `Ptr<uint64_t>` subscript store is invalid; file it only if it reproduces and is a new bug.
- 11-04 ~15:40Z: side bug D filed by the triager as **#14306** (bot, label `reproduced`). Wider than
  my 15:24 dashboard note: `uint16_t`/`uint8_t` offsets are wrong on CPU, CUDA **and SPIR-V**
  (+65535/+255 elements); `uint`/`1u` wrong on CPU/CUDA only; `uint64_t` and `int` correct. The
  `issue_opened` webhook needed no dispatch (this chain owns it). Fixer chain = operator decision,
  still default "filed only"; dashboard told the issue number and the wider scope.

- 11-04 15:30Z: side bug D filed by the triager as **#14306** (bot, 15:27:36Z, `reproduced`; I verified
  it). It is wider than first reported: `p - uint16_t(1)` / `uint8_t` move +65535 / +255 elements on
  **all targets, SPIR-V included** (even with `[Shader64BitIndexing]`). **#14306's issue_opened webhook
  needs NO dispatch**; it is FILED-ONLY until the operator decides on a fixer (asked on the dashboard
  11-04; default no fixer). E = duplicate of open #13393 (and of #8630); dropped, no post.
- 11-04 18:20Z: maintainer jkwak-work commented "This could be a driver bug" (cmt 6638514316). The
  comment has no @nv-slang-bot mention and no ask. By then the issue was **assigned to kaizhangNV** with
  label `RTR`, so maintainers now own the decision. No bot reply. I told the triager to stand down from
  posting; the 11-09 re-check posts only if a maintainer asks the bot something.
- 11-04 17:31Z: **jkwak-work self-assigned #14306** (assigner = assignee) and milestoned it Q1 2027.
  Rung-4 hold: no fixer, no bot post. My 11-04 "start a fixer?" ask to the operator is moot and is
  closed on the dashboard (11-05). Same minute: jkwak-work assigned **#14305 to kaizhangNV**, labeled
  `RTR`, milestoned Q1 2027, and commented 18:20Z "This could be a driver bug" (no bot mention, so
  no summons). Both issues are maintainer-owned now; the triager re-check on 11-09 will see this.
- 11-05 11:36Z: the dashboard asked for a #14306 triage verdict. Answered from the filed evidence:
  core module `Ptr` `operator-`, medium/P2, held under jkwak-work. Nothing was dispatched.

