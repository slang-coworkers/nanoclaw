---
type: project
name: project_13433_interface_static_const_witness_null_crash
description: "slang#13433 (bot-filed 10-05, side finding from #13430): interface `static const b = a…` → correct E30623 ×2 then Release SIGSEGV rc 139 / Debug assert slang-check-expr.cpp:2840 (null witness from findThisTypeWitness in tryConstantFoldDeclRef). Regression first seen 2026.16, plausibly #11706. P3. Filed on Orchestrator's order; NO fixer routed; reopens only on a human comment."
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
