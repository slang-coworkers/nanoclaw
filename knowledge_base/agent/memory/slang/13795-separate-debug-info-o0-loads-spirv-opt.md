---
type: chain
title: slang#13795 — `-O0 -separate-debug-info` loads slang-glslang and calls its optimizer
description: MEMBER-filed (pdeayton-nv) 10-20 23:33Z, assigned to the reporter. TRIAGED 23:45Z (reproduced, one root cause in createArtifactFromIR). 10-21 00:06Z the assignee asked @nv-slang-bot for a PR, fix direction at our judgment. Routed to the triager, which owns the fixer handoff.
tags: [slang, spirv, debug-info, downstream-compiler, triage]
---

# slang#13795 — separate debug info at -O0 goes through the spirv-opt wrapper

**10-20 23:33:47Z, `issue_opened`.** Live read at 23:3xZ: open, 0 comments, no labels, live body =
payload. Reporter pdeayton-nv (MEMBER). Timeline `assigned` actor = jhelferty-nv (timeline `actor` is
who did it), assignee pdeayton-nv — so it is maintainer-assigned to its reporter, not a self-assign.

**Claim (reporter's):** adding `-separate-debug-info` to `-target spirv -O0 -g2` calls
`glslang_compile_1_3` once (opt level None, no passes); `-spirv-opt-path nonexistent.dll` then gives
E00100 + E99996 and an access violation `0xC0000005`. The control without the flag succeeds.

**Likely related:** [#12383](../imported/project_12383_spirv_validation_before_spvopt_strip.md) — the
`-separate-debug-info` strip (`stripDbgSpirvFromArtifact` in `createArtifactFromIR`, slang-emit.cpp)
is independent of `-O` level. My hint only; not verified at current master.

**Routing:** dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13795` (triage + repro +
public triage comment). No fixer: the assignee owns the fix, as in #13336/#13337.

**23:36Z:** triager acked (msg 8). It is rebuilding slangc at master `a760da2f` and researching both questions, triage + repro only.

## Triage, 23:45Z (the triager's finding; I checked the source legs myself)

Reproduced on Linux at master `a760da2fb`. One coupling in `createArtifactFromIR` (`source/slang/slang-emit.cpp`) causes both halves:
- **(1) The no-op call.** `needsDownstreamCompiler` includes `needsSeparateDebugInfo` (:3581-3583), so the SpirvOpt
  compiler is loaded. `compile()` (:3688) is not gated on `needsOptimization`, and the debug strip plus the `dbgArtifact` assignment
  (:3693-3700) live only inside `if (SLANG_SUCCEEDED(compile()))`. The triager's shim logged one `glslang_compile_1_3`
  with OPTIMIZE_SPIRV, optLevel 0, flags 0.
- **(2) The crash.** A failed load leaves `compiler` null, so `if (compiler)` (:3593) skips the block. The function returns SLANG_OK
  with `dbgArtifact` null, and the caller derefs it at `addAssociated` / `getName()` (:3746/:3751). The result is a segfault in Release (exit 139), or the assert
  at `slang-artifact-impl.cpp:244` in Debug. This also happens at -O1 with the split.
- **Recommended:** A+B in one PR. (A) Decouple: drop the split from the load gate, gate `compile()` on `needsOptimization`, and strip the final
  artifact after the block. (B) Return SLANG_FAIL when the compiler is null or `compile()` fails. Rejected: a null guard at :3744 (it masks the problem).
  The coupling dates from #7178 and #11797 kept it on purpose. #12383 is a separate defect in the same block.

**Verified (mine, 23:4xZ):** master is `a760da2fb0`. I checked the gate, `if (compiler)` :3593, `compile` :3688, strip :3693-3700, and the deref
:3746/:3751 against `git show origin/master`. Bot triage comment [6304347467](https://github.com/shader-slang/slang/issues/13795#issuecomment-6304347467)
was posted 23:45:26Z (4391 chars). Labels are `reproduced`, Type is Bug, and the assignee is pdeayton-nv. Memo: `/workspace/inbox/a2a-1792539968393-hvtzrc/triage-13795.md`.
No fixer was dispatched.

## 10-21 00:06Z: the assignee asks for a bot PR

[issuecomment-6304621222](https://github.com/shader-slang/slang/issues/13795#issuecomment-6304621222) (pdeayton-nv, MEMBER,
not edited: live body = payload): *"@nv-slang-bot , please prepare a PR, using your judgment on the fix direction."*
This releases the triage-only hold. I routed it to `slang-triager` (session `m93m8d`, canonical thread), because the
triager owns the fixer handoff ([no-skip rule](../imported/feedback_triage_memo_is_not_my_cue_to_dispatch_the_fixer.md)).
At routing time no slang-fixer session existed for 13795.

**00:08Z, fixer handoff (verified):** the triager handed off at msg 13 with an A+B brief. The handoff comment is
[6304649845](https://github.com/shader-slang/slang/issues/13795#issuecomment-6304649845) (nv-slang-bot, 00:08:02Z). There is exactly one fixer
session, `sess-1792541257795-foxi1s` (slang-fixer, triager edge `epsn3s`, created 00:07Z), so no duplicate. Next: a draft PR, then the triager's
[Triage Resolution].
