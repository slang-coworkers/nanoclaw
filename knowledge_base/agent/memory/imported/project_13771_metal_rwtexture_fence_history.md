---
type: project
name: project_13771_metal_rwtexture_fence_history
description: "Dated history of the slang#13771 / PR #13792 Metal texture-fence chain (10-20 13:13Z → 10-21 19:2xZ): triage, ownership, draft PR, R1/R2 reviews, every CI check, operator escalations. Split from project_13771_metal_rwtexture_fence on 2026-10-22; new dated entries append here."
metadata:
  node_type: memory
  type: project
---

# slang#13771 / PR #13792: dated history

Current state and decisions: [[project_13771_metal_rwtexture_fence]].

## 10-20: triage and handoff

- **13:13Z `issue_opened`**, external reporter (same person as #13633/#13753/#13774/slangpy#1232). Routed to
  slang-triager on `gh-issue-shader-slang/slang-13771` (my webhook session `sess-1792502009853-1i67fs`).
- **13:49Z triage** (cmt [6292409391](https://github.com/shader-slang/slang/issues/13771#issuecomment-6292409391)): bug,
  medium, P2, Metal emit, not a regression; `reproduced` + Type=Bug. Memo
  `/workspace/inbox/a2a-1792504245586-kkut7u/triage-13771.md`, scratch `/workspace/agent/scratch-13771/`. The gap is
  wider than reported: `RWBuffer` (string-intrinsic setter), callee write → caller read, ROV, texture atomics, and
  Slang's own `legalizeImageSubscript` RMW. Prior art: Tint fences before+after each store; SPIRV-Cross before each read.
  I verified at master `7251cc60b4`: `hlsl.meta.slang:20672` (`$0.write($2, $1)`), `slang-emit-metal.cpp:1043/1062`,
  `slang-emit.cpp:2413` legalizeIRForMetal before `:2474` legalizeImageSubscript, zero `fence` in the Metal emitter/legalizer.
- **13:50–13:54Z** approved the triager's normal fixer handoff with the reporter guard; fixer `i4wuxx` created on
  edge `epsn3s`. Conflict note: the reporter's open #13755 also edits slang-emit-metal.cpp (a different area).
- **14:20Z** reporter (cmt 6293057817): "the automated fixer can go ahead with approach A"; no Mac; offered to review.
  Relayed verbatim to the triager.

## 10-20: draft PR and R1

- **20:56Z draft #13792** @`85e57b862` (+197/−3, 12 files, `Fixes #13771`); status cmt 6301290345. I checked the
  #13755 hunk overlap myself: none. Fixer-reported suite 10955/10958 (3 fp8 CUDA failures, also on master).
- **21:04Z regression** (triager's finding, fixer-confirmed): the fence's second use made `simplifyForEmit`
  (slang-ir-simplify-for-emit.cpp:136) copy the texture-handle array; I verified `canInstHaveSideEffectAtAddress`
  (slang-ir-util.cpp:1622) had no ImageStore case (callers :573/:615/:688, all targets).
- **22:11Z fixed** @`1705cc56a` (2604cf7 alias case, f945cb7 tests incl. `tests/spirv/texture-array-texel-write.slang`).
  Reporter built 2604cf7 on Windows: "approach looks right" (cmt 6302260803); blocking ask = green macOS run. Run
  39505661665 `success` was 2 success / 48 skipped (docs-only last commit); earlier runs cancelled.
- **22:29Z** head `59ac5030a1` (ARRAY test lane); run 39507383213 yielded at the priority gate.
- **23:41Z R1 REQUEST_CHANGES** (0 bugs / 3 gaps / 4 nits; reviewer `ex68mp`; report
  `/workspace/inbox/a2a-1792539656738-9ycey3/combined-review-13792-r1.md`; nothing posted). RC1 unfenced WAR (the
  crbug's actual hazard); RC2 RWBuffer setter now pads to 4 components, unpinned; RC3 5 of 6 NOFENCE-NOT lines vacuous.
  Out of scope: ROB emitted `access::write` but read → spin-off.
- **23:58Z** triager passed RC1 to the fixer, corrected triage cmt in place. **#13796** filed 23:51Z (bot); I verified
  `hlsl.meta.slang:20562-20569` passes loop index `aa` as access, so ROB gets aa=2 = WriteOnly
  (slang-type-system-shared.h:101). Owned by sibling Main `fun2vl`; told the triager not to hand it off here.

## 10-21: R2, CI livelock, escalation

- **01:48Z R2 APPROVE_WITH_NITS** @`bd3444ec43` (report `/workspace/inbox/a2a-1792547319249-802x7y/combined-review-13792-r2.md`):
  RC1–RC3 met with mutation drills; merges cleanly on master `8896a5102`. Nits: ROB doc row + #13796 link, "after"-only
  comments, tighter tests, a ParameterBlock texture-atomic lane, spec-vs-hardware note. Devin's "pointer-backed texture
  atomic abort" not reproducible (0/465). Run 39521173251 @bd3444e yielded.
- **01:5xZ** retry workflow (`CI Retry Yielded Bot`, id 304423273) logged "CI is still active (85 run(s)); not rerunning".
- **02:01Z** nits applied @`accfd0d97f`; run 39530615997 waiting. **02:0xZ** escalated three options to
  orchestrator-dashboard; timer `rechase-13771-pr13792-ci-c32d` for 14:00Z. **02:15Z [Triage Resolution]**.
- **14:01Z** re-check (session `d0jxep`) found case (c): no change, no operator reply (since seq 506508), 89 waiting
  ci.yml runs. Re-asked once — final, no new timer.
- **19:11Z** reporter asked a maintainer to trigger the macOS lanes (cmt 6324333622); **19:14Z** fixer replied with the
  run id and remedy (6324379785). 19:2xZ: one delta to the dashboard (not a third ask); chain carried by
  supervisor-state `_meta.operator_decisions`.
- **10-22 00:0xZ** (OKF synthesis run, live read): still DRAFT/OPEN @accfd0d97f, last update 19:14Z.
