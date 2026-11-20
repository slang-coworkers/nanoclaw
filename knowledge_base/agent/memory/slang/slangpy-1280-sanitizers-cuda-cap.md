---
type: chain
title: slangpy#1280 — sanitizers.yml nightly missing SGL_MAX_CUDA_COMPUTE_CAPABILITY cap (patch parked on operator credential decision)
description: Maintainer ask (daily reports since 11-01, 3rd/4th re-ask); dispatched 11-16 19:09Z; mechanism verified, 2-line fix committed but unpushable (nv-slang-bot App lacks workflows permission); patch delivered as slangpy#1280; parked on operator (a) grant permission (b) hand-apply; two re-checks scheduled.
tags: [slangpy, ci, sanitizers, cuda-capability, permissions, parked-operator]
---

# slangpy#1280: sanitizers nightly — CUDA ray-tracing tests fail, cap missing

**Ask.** The `sanitizers.yml` nightly (cron 0 4 * * * ASan/UBSan, windows+linux GPU legs) has failed **10 straight scheduled
runs 11-07→11-16** (runs 43802285857/43675393432). Same failure class as [#1214](slangpy-1214-cuda-cap-ci-latest-slang.md)
(the ci-latest-slang.yml instance, fixed by jkiviluoto-nv's #1215): `SGL_MAX_CUDA_COMPUTE_CAPABILITY` exists in ci.yml:75-76
and ci-latest-slang.yml:28 but NOT in sanitizers.yml — the only GPU workflow without it. Maintainer (Slang Maintainer daily
reports 11-01 and 11-06, re-asked 11-16 09:50Z) asked for the one-liner; its draft was the diagnosis.

**Dispatch 11-16 19:09Z** (thread `slangpy-sanitizers-sgl-max-cuda-cap`, fixer session `sess-1794856174989-r9h311`):
verify mechanism from run logs, then apply + PR.

**Verified by the fixer (its findings, receipts in #1280):** 6 CUDA ray-tracing tests fail identically on both asan-ubsan GPU
legs at `createRayTracingPipeline` with `Invalid PTX input / _optix_trace_typed_32 / Target architecture invalid`. Second
independent root on linux: LSan leak #1130 — the cap alone will NOT fully green the linux leg (windows should go green).

**Fix:** branch `fix/issue-1214`, commit `00399515`, 2 lines mirroring ci.yml verbatim, committed in fixer worktree
`/workspace/agent/wt-sanitizers-cuda-cap` (its container). Critique PLAN/CODE/OUTPUT all approved.

**Blocker (verified server-side by the fixer):** the nv-slang-bot GitHub App token **lacks `workflows` permission** — pushes
touching `.github/workflows/**` are rejected; slang-coworkers fork push also 401s. Source-only PRs (#14502/#14500) never
exercised this path. Fleet learning appended 11-16.

**Patch artifact:** filed as **slangpy#1280** (nv-slang-bot, 19:42:35Z, verified) — git-apply-ready, evidence + expected-result
caveat, so a maintainer can apply the 2 lines directly.

**Parked on operator decision** (dashboard 19:25Z note + 19:5xZ delta, row 512878): (a) grant the App Workflows permission
(or connect a user GitHub account with repo+workflow scopes via the gateway connect URL, agent_name=slangpy-fixer), or
(b) hand-apply the #1280 patch, or (c) park. Re-checks: fixer one-shot push-retry → auto draft PR **11-17 01:30 UTC**;
Main one-shot `sanitizers-cap-perm-recheck` **11-18 19:30Z** (file check → operator-reply check → one nudge max).

**Re-check 11-17 01:30Z (fixer one-shot, ran as scheduled):** push of `fix/issue-1214` (00399515) to origin **still REJECTED** — identical
`workflows permission` error; 1 attempt, no retry; no PR opened. Status comment posted on #1280 (issuecomment-6935019922, verified
01:31:22Z). Blocker unchanged since 11-16 19:50Z → **no new operator alert** (dedupe rule; parked ask row 512878 stands); backstop
`sanitizers-cap-perm-rech-7d19` 11-18 19:30Z owns the one-nudge-max. Worktree + sentinel `active-work/sanitizers-cuda-cap` retained.

**Peer review 11-16 20:22Z: APPROVE** (slangpy-reviewer, 0 bugs / 0 gaps; diff hash 5fd331c88c…; verdict relayed to the fixer
session). Reviewer's verified nuance: the 6-test failure is NOT deterministic across legs — run 43675393432's **windows leg passed**
(4930/0); only 43802285857 shows both legs red, so the failure tracks the runner pool's GPU/driver assignment (the cap is a no-op
on GPUs ≤ 90). Post-merge suggestion: maintainer workflow_dispatch for same-day validation; linux leg stays red at LSan #1130.

**11-17 01:30Z push-retry: REJECTED again** (workflows permission still missing — exact server error in the #1280 status comment
posted 01:31:22Z, verified live; no PR opened). Routing note: the retry task session's follow-up [Report] (01:31:31Z, session
sess-1794858848697-p0bkh3, dir=out) was never received — no Main session minted on the thread, nothing on the dashboard, nothing in
dropped-messages; the outcome was recovered from #1280 (system of record held). Operator decision unchanged and still open
(rows 512878/512882); backstop `sanitizers-cap-perm-recheck` 11-18 19:30Z stands. Maintainer's 11-17 daily report asked for an
owner — moot, the chain is owned; the ask is the operator unblock.
