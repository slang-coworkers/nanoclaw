---
type: project
name: project_13433_interface_static_const_witness_null_crash
description: "slang#13433 (bot-filed 10-05, side finding from #13430): interface `static const b = a…` → correct E30623 ×2 then Release SIGSEGV rc 139 / Debug assert slang-check-expr.cpp:2840 (null witness from findThisTypeWitness in tryConstantFoldDeclRef). Regression first seen 2026.16, plausibly #11706. P3. Filed on Orchestrator's order. 10-06 jkwak-work self-assigned (Q4 milestone) + asked @nv-slang-bot to triage → routed to slang-triager; 10-06 18:07Z triage posted (root cause = _validateCircularVarDefinition folds DirectDeclRef(b) after E30623; #11706 confirmed by revert drill); waits on jkwak-work for a draft-PR go-ahead, gated by i13433-decision-gate."
metadata:
  node_type: memory
  type: project
---

# slang#13433 — interface static-const requirement fold crash after E30623

**Origin.** Side item (a) of the #13430 chain. The fixer found it; slang-triager reproduced it (Release rc 139,
Debug E99997 assert at `slang-check-expr.cpp:2840`); Orchestrator first failed to reproduce (probe grepped the first
error line, never checked `$?`), retracted, re-ran on Release `6ba151dcfc` and ordered the filing (2026-10-05 03:18Z).

**Filed 03:23Z by nv-slang-bot** via slang-triager: labels bug/regression/reproduced, Type=Bug, P3, cross-links
#11706 (cde7d65f8, first tag v2026.12.1) as a *plausible* cause, sampled-release window (≤2026.12 clean, ≥2026.16
crash), no @-mentions, no #13430 mention. The dashboard 5-bullet went out on `gh-issue-shader-slang/slang-13433`.

**Disposition: owned, nothing to dispatch.** The `issue_opened` webhook (03:23Z) is the filing's self-echo; live
read at 03:24Z showed open, 0 comments, labels as filed. No fixer by explicit decision; no re-chase task (not parked on
a decision — left for maintainers). **Resume only on a non-bot comment** on #13433.

Related: #12700 (default arg referencing a requirement, asserts in lower-to-ir; shared cause not ruled out).

**Resume gate (10-05 06:23Z):** `i13433-maintainer-gate-6a3c` (12h) runs `GATE_ISSUE=13433 bash /workspace/agent/gates/i13435-maintainer-gate.sh`. It fires on CLOSED or a non-bot comment.

**10-06 16:27Z — reopened by a maintainer.** jkwak-work (MEMBER) self-assigned it, set milestone Q4 2026 (Fall), and
commented "@nv-slang-bot can you triage this issue?" ([6020725930](https://github.com/shader-slang/slang/issues/13433#issuecomment-6020725930)).
A sibling Main had armed `i13433-maintainer-gate-6a3c` (12 h, script `gates/i13435-maintainer-gate.sh`) for exactly
this; I routed the mention directly and **cancelled the gate** so its 10-07 00:00 fire doesn't re-route it.
Routed to slang-triager on `gh-issue-shader-slang/slang-13433` with `<github-post-authorized />`. The brief asks for
what the body leaves open: why `findThisTypeWitness` is null, the Release fault site, an optional bisect between 2026.12 and 2026.16 for
#11706, a producer-layer fix direction (not a null-check at :2840), and the #12700 relation. The reply goes to @jkwak-work.
**No fixer**: the assignee owns the fix decision, so the triager offers one in next-action.

**10-06 18:07Z — triage posted** ([6022427830](https://github.com/shader-slang/slang/issues/13433#issuecomment-6022427830),
7604 chars, Main-verified author nv-slang-bot[bot]). Triager's findings (triager-reported; the posted comment is the record):
- **Corrects the body:** the trigger is not a fold of `a`. `checkVarDeclCommon` (slang-check-decl.cpp:3476) reports E30623,
  then still runs `_validateCircularVarDefinition`, which folds `DirectDeclRef(b)`. With no `LookupDeclRef`,
  `findThisTypeWitness` returns null (slang-syntax.cpp:1067) → `WitnessLookupIntVal(null)` → assert :2840 / deref :2841.
  `static const int b = 1 + 1;` alone crashes.
- Release fault confirmed at :2841 (`si_addr=0x10`, addr2line).
- **#11706 confirmed:** 2026.12/2026.12.0.1 clean, 2026.12.1–2026.16 crash; reverting only its hunk removes every shape.
- Fix: null witness is a valid shape → not a null-check. Option 1 (recommended): the caller skips interface
  requirements in `_validateCircularVarDefinition`. Option 2: the folder returns null with no ThisType witness. Both were
  prototyped and reverted; each passes 830/830 on the language-feature/bugs subset.
- #12700 is a separate cause (lower-to-ir.cpp:5245).
- Side find, **unfiled**: `int x[I::N]` / `I::N` through the interface type crashes, already broken in 2026.12.0.1.

**Parked on jkwak-work**, who decides on the draft PR (option 1) and on filing the `I::N` crash. Resume gate
`i13433-decision-gate-*` (12 h; `gates/i13433-decision-gate.sh` fires on close or a non-bot comment after
18:07:06Z; controls verified: cutoff 16:00Z → fires on jkwak's request, closed #12457 → CLOSED). A plain reply
without a mention never arrives as a webhook, which is why the gate exists.
