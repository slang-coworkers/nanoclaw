---
name: project_11476_autodiff_finalization_gate_retarget
description: "#11476 (fix/issue-11474) autodiff-finalization skip — pdeayton asked (07-17) to RETARGET into #11917 epic w/ specific gate; fell through (no 👀); routed to fixer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5bec4191-e017-44da-b211-e48a8839d909
---

shader-slang/slang **PR #11476** "Skip autodiff finalization passes for modules with no autodiff IR" — DRAFT, author nv-slang-bot, branch `fix/issue-11474`, base master. Canonical thread `gh-issue-shader-slang/slang-11476`. This is the autodiff pass = the **"canonical trap"** of the #11917 pass-gating epic ([[project_11917_pass_gating_epic]]).

**History:** pdeayton asked (07-02) to rebase+verify effect → fixer found (07-03) the change is a **no-op for ordinary shaders as written** → pdeayton said "implement a proper fix" → fixer profiled (07-03), measurements pointed "somewhere important" (Slang…, comment truncated). Then quiet until 07-17.

**⚠️ FELL THROUGH — live maintainer ask not picked up (07-17 16:09Z; operator flagged "no 👀 from nv-slang-bot" msg 43636).** pdeayton-nv @-mentioned @nv-slang-bot (issuecomment-5005163002). **Byte-exact ask:**
> @nv-slang-bot , could you retarget this PR as part of issue 11917's skipping IR passes when they're not needed?
> Investigate if this could work:
> Run finalizeAutoDiffPass when structural autodiff IR is present; otherwise still run stripAutoDiffDecorations so linked builtin decorations and keep-alives are removed before DCE. lowerDiffTypeInfoInsts can use the same gate.
>
> You'll need to rebase the PR and update the description since it won't be related to issue 11474 anymore.

Main verified: **0 sessions** on 11476/11474 thread (genuinely orphaned, not a stale-session pickup). Cred recovered ~13:56Z ([[project_github_actions_graphql_401_outage]]) so fixer CAN rebase/push now.

**Routed to slang-fixer (07-17)** on canonical thread `gh-issue-shader-slang/slang-11476`, `<github-post-authorized />`. Task: 👀-ack + investigate pdeayton's gate, rebase, retarget #11474→#11917.

**✅ 2026-07-17 17:09 — PICKED UP + SAFETY-TRACED SAFE (fixer msg 43640).** 👀-ack posted on pdeayton's comment; `fix/issue-11474` rebased onto current master (clean, no conflicts — cred recovered so push works).
- **Gate is SAFE — NOT the matrix-pass stale-FALSE trap** (two independent traces: fixer source-read + dedicated Explore subagent, converged). Stale-FALSE needs the trigger IR synthesized AFTER the scan point (slang-emit.cpp:1025); it can't be here — every trigger op (Forward/BackwardDifferentiate, DifferentialPair types, DetachDerivative, Annotation, DiffTypeInfo) is **front-end-produced, present before the scan**. In-window passes (checkAutodiffPatterns diagnostic-only, specializeModule, specializeHigherOrderParameters) only specialize EXISTING autodiff insts; none manufacture autodiff IR from nothing; fresh derivative synthesis needs an IRTranslateBase request the scan already saw. Corroborated: the linker's own `doesModuleUseAutodiff` (link.cpp:2119) uses the same full-recursive-walk (its comment: module-scope-only scan "fails ~240 tests").
- **pdeayton's split is sound; "always strip" half is load-bearing (bloat, not correctness):** `stripAutoDiffDecorations` removes AutoDiffBuiltin + KeepAlive on core-module builtins linked into every module; skipping it → DCE can't drop them → **#9808/#11781 regression class**. Takes only IRModule*, cheap.
- **Nuance fixer will flag to pdeayton (not a blocker):** `releaseDifferentiableInterfaces` also removes KeepAlive, on IForward/IBackwardDifferentiable interfaces which do NOT carry `[__AutoDiffBuiltin]` → `stripAutoDiffDecorations` alone won't touch those; their residual keepalive is handled by the linker's own prune.
- **✅ DONE 2026-07-18 01:16 — shipped, peer review dispatched (fixer msg 45268; Main-verified at HEAD).** pdeayton's ask answered on-thread (issuecomment-5009069628); PR #11476 rebased + retargeted (head `bd729b9e51`, base master, OPEN/draft, updated 01:15Z — Main REST-confirmed). Split implemented: **3 files, +95/−3** — `slang-emit.cpp` (extend `.autodiff` predicate + gate finalizeAutoDiffPass/lowerDiffTypeInfoInsts, else-branch `stripAutoDiffDecorations`) + 2 new autodiff tests. **Gate re-confirmed SAFE** (final trace): all autodiff trigger IR front-end-produced before the emit scan (`slang-emit.cpp:1042`); autodiff-relevant in-window passes (specializeModule, generateDerivativeWrappers) only specialize existing insts / wrap recorded operands, never manufacture trigger IR; "always strip" load-bearing for DCE of core-module autodiff-builtin keepalives. Two independent traces + codex PLAN/CODE/OUTPUT all approve. Tests: Debug build 1176/1176; autodiff suites **664/664** pass; gh-9526 regression 1/1 (vk/other legs CI-covered). **Peer review dispatched to slang-reviewer** (thread `gh-issue-shader-slang/slang-11474`); CI dispatched (draft, run 29624580482). Draft-held; merge maintainer-gated; fixer handles REQUEST_CHANGES per max-2-round path. **Next:** reviewer verdict + maintainer review; webhook-driven.
- **Outcome note:** this validated the routing — an orphaned maintainer ask, picked up + traced-safe-with-rigor + shipped clean. Confirms the RARE #11917 late-pass that's genuinely A-safe (autodiff triggers front-end-produced, not in-window-synthesized) — contrast the B/C-risky tail jkwak parked.

**Note:** this is the RARE #11917 late-pass that traced A-SAFE (contrast the B/C-risky tail jkwak parked) — because autodiff triggers are front-end-produced, not synthesized in-window. Don't conflate with the matrix/tag-union/legalize families.
