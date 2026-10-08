---
type: chain
title: slang#13420 — false-positive E41035 when the store and the read sit under the same condition
description: Triaged + reproduced regression (#11293, v2026.11); path-insensitive must-init walk. Maintainer assigned it to the reporter, so NO-GO; fixer stood down
tags: [slang, ir, diagnostics, uninitialized-values, regression, parked]
resource: /workspace/inbox/a2a-1790993086700-996pfk/triage-13420.md
---

# slang#13420 — E41035 on `if (c) x.set(..); if (c) use(x)` (parked on author)

Reporter pdeayton-nv (MEMBER, `Dev Opened`). **Assigned to the reporter by maintainer jhelferty-nv**
at 2026-10-03T01:06:14Z. The events API reports `actor=pdeayton-nv` but `assigner=jhelferty-nv`, and the
timeline API reports `actor=jhelferty-nv`. I first misread `actor` as "self-assigned" and sent the
triager a wrong correction, then retracted it. The triager's original reading was right.

**Mechanism (triager, prototype-verified at master 6ba151dcf):** `cancelLoadsByDefiniteAssignment`
(slang-ir-use-uninitialized-values.cpp:811) is path-insensitive. Its only branch pruning is
`getInfeasibleBranchFromPredecessor` (:553, the constant phi arg from `&&`/`||`), plus the loop-break
and WaveIsFirstLane relaxations. It has no memory of an earlier `ifElse` on the same SSA condition.
The check runs at lower-to-ir.cpp:16262, before linking, so `extern static const` conditions are
unresolved and folding them can't fix the reported shape. The bug is not specific to `Conditional`
or to constant conditions: a runtime `bool c` warns too. Regression: v2025.24 is silent, and E41035
was added by #11293 (v2026.11). Related: #12545/#12894.

Approach A: condition correlation in the walk. A reverted ~90-line prototype fixes the repro and
its variants, the must-still-warn controls still warn, and the subsets pass 3601/3602 (the one
failure also fails on master). A real fix needs a walk-state cap with fallback, plus DIAGNOSTIC_TEST
cases for both the fixed shapes and the must-warn shapes. Prototype and shaders:
`/workspace/agent/scratch-13420-shaders.tgz`.

**State 2026-10-03 ~02:06Z:** triage comment
[5964401022](https://github.com/shader-slang/slang/issues/13420#issuecomment-5964401022)
(nv-slang-bot, 3524 chars). Labels: reproduced, regression, Diagnostics (+ human `Dev Opened`);
Type=Bug. **NO-GO ratified by Orchestrator** (a maintainer routed it to a human owner; same outcome as
#13336/#13337/#13048). The triager edited 5964401022 in place (3696 chars) to offer a bot draft PR on
request. slang-fixer is stood down and keeps the briefing warm (stand-down msg 15).

**Resume on:** a PR from the assignee, a human comment asking for a bot PR (→ release the held
fixer briefing on the canonical thread), or closure. Re-chase `rechase-13420-assignee-3979`
(2026-10-14).

**2026-10-07 re-chase:** still silent. The issue is open and assigned to pdeayton-nv, the only
comment is the bot triage, the sole new timeline event is the bot's cross-ref from #13419, and no PR
references #13420. I logged one line to the dashboard and re-armed for 7 days. The previous one-shot
`bc0c` was consumed when it fired, so it can't be `update`d; I created a fresh task instead.
