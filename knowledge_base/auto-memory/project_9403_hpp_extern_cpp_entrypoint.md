---
name: project-9403-hpp-extern-cpp-entrypoint
description: "#9403 -target hpp + __extern_cpp compute entrypoint emits invalid C++ header — ✅SHIPPED PR #12152 MERGED 07-29 71a3f7e71a; TERMINAL"
metadata: 
  node_type: memory
  type: project
  originSessionId: ecd9809d-63fb-4550-9d53-f5b5080a670c
---

# #9403 — `-target hpp` + `__extern_cpp` compute entrypoint generates invalid C++

**✅ TERMINAL — SHIPPED 2026-07-29 15:42:31Z.** PR #12152 MERGED by pdeayton-nv (merge commit `71a3f7e71abea0a84db90a9542fb93fd89b23dff`); issue #9403 auto-closed as `completed` 15:42:32Z via `Closes #9403`. Main-VERIFIED from GitHub API (merged=true, issue state=closed/completed). Shadow approver row WOULD_APPROVE CLEAN vs human APPROVE = agreement match. Fixer cleaned worktree + sentinel. Chain closed — no further action. History below preserved for audit.

**07-29 15:42Z ✅ #12152 MERGED `71a3f7e71a` — nudge worked, chain TERMINAL.** After the 10:15Z approver nudge, pdeayton-nv hand-re-added #12152; it merged 15:42:31Z (well before the 15:20Z... actually just past, but recovered without escalation). #9403 auto-resolved via `Closes #9403`. Babysitter silent on #12152 in 20:00Z sweep = confirmed recovered. No escalation needed. Triager owes #9403 issue-comment refresh→close-out (non-draft PR carried the trail). Nudge-once pattern (verify-stranded → one approver nudge → merged) matched #12122/#12151/#12202.

**07-29 10:15Z MERGE-QUEUE NUDGE (babysitter escalation, Sig-B eviction pattern — same as #12122/#12151):** pdeayton-nv enqueued #12152 07-28 21:29:20Z → evicted 07-29 00:20:04Z (`failed_checks` = #12145 GBuffer d3d12 0xC0000005 + computeSmokeD3D12 JSON-RPC drop, merge-group flakes NOT head checks) → stranded `mergeQueueEntry=null`, no auto-requeue. Main-verified: APPROVED/non-draft/MERGEABLE, 46 pass/34 skip/0 fail, autoMerge=null. Posted ONE approver nudge to pdeayton-nv to hand re-add (comment 5116312969; 0 prior comments, non-dup). Bot can't self-enqueue (#11675). Babysitter operator-escalation bar = 15:20Z (00:20Z+15h) if still stranded. HUMAN-ONLY requeue; no re-nudge.

**State (2026-07-28):** OPEN, PR #12152 ready-for-review + **human-APPROVED by maintainer pdeayton-nv @ HEAD `9148d9a7b6`** (approval commit_id == head, NOT stale); `Closes #9403`, `pr: non-breaking`; full non-draft `pull_request` CI GREEN on head. `mergeable=MERGEABLE` but `mergeStateStatus=BLOCKED` = branch-protection gate (likely required-approval-count / merge-queue), non-actionable on bot side — a push would dismiss the approval. Held on **merge** (maintainer/operator-gated). Shadow approver row: **WOULD_APPROVE (reason_code=CLEAN)** @ `9148d9a7b679`; human APPROVE now lands as agreement (shadow WOULD_APPROVE vs human APPROVE = match). Triager holds the issue-comment refresh until merge (non-draft PR carries the public trail); will refresh + close out #9403 on merge.

**Prior (2026-07-18):** routed to slang-pr-approver → shadow WOULD_APPROVE CLEAN; 6/6 eligibility clauses PASS; Devin-only FALLBACK tier (harvest exit 20, prod skips bot branches): 0 bugs/0 flags/3 confirmations; challenger cleared all 3 predicted-miss axes. Fixer resolved the peer-pipeline flag: CUDA `-target cuh` structurally unaffected (`CUDASourceEmitter::emitModuleImpl` calls grandparent `CLikeSourceEmitter::emitModuleImpl`, bypassing CPP override; empirically emits zero wrappers). Triaged by slang-triager on jkwak-work's request; fixer resolved into a draft.

**Bug:** `-target hpp` emits compute-entrypoint wrapper functions as full DEFINITIONS whose bodies call `_example(...)`, but the `_`-prefixed workhorse is never declared/defined in the header → header won't compile. Only triggers when the entrypoint survives DCE via `__extern_cpp`/export. Reproduced on ToT `aaa07fe29` (CPU, no GPU).

**Root cause:** wrapper loop in `CPPSourceEmitter::emitModuleImpl` (slang-emit-cpp.cpp:2369-2438) never consults `shouldEmitOnlyHeader()`; workhorse decl suppressed by `asEntryPoint` early-return in `emitFuncDecl` (slang-emit-c-like.cpp:3948-3954).

**Fix (draft PR #12152, `fix/issue-9403`→`master`, `Closes #9403`, `pr: non-breaking`, nv-slang-bot):** guard the wrapper loop on `shouldEmitOnlyHeader()` to emit the three wrappers as PROTOTYPES. Triager's recommended `_example` forward-decl proved unnecessary (dead once bodies stripped) — fixer's simplification is correct. Repro test `tests/headers/generate-hpp-extern-cpp-entrypoint.slang` PASS; tests/headers 3/3; `-target cpp` byte-identical; debug 571/571.

**GitHub:** verdict 5-bullet posted (comment 5011419900); `reproduced` label applied (Type=Bug left human-set).

**Next human action:** review draft #12152 → flip ready → merge (auto-closes #9403). CI red on that run = benign bot priority-gate yield (`wait-for-human-priority`/`check-ci`, builds skipped), not a real failure.

**Ownership:** slang-triager owns triage→fixer→reviewer hops and forwards resolution upstream on thread `gh-issue-shader-slang/slang-9403`. Watch-only for Main; do not double-dispatch. See [[feedback_no_double_dispatch_peer_wired]], [[feedback_drafts_only_guardrail]].
