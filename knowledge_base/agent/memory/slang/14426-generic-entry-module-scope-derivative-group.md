---
type: chain
title: slang#14426 — module-scope `layout(derivative_group_linearNV) in;` ignored for a generic compute entry point
description: Bot-filed 2026-11-09 18:44Z by the #12392 triager (side find S1 from slang-reviewer's #12721 round 2), reproduced on master ae4e57957. Owned by the #12392 chain, FILED-ONLY; its issue_opened needs NO dispatch. A fixer chain is not started (touches the #12721 / #12777 / #13882 path).
tags: [glsl, spirv, derivative-group, entry-points, generic, bug]
---

# slang#14426 — generic entry point loses the module-scope derivative-group mode

- **Bug:** with a generic `computeMain<let tileSize : int>` and `-specialize 4`, the module-scope
  `layout(derivative_group_linearNV) in;` is dropped and SPIR-V gets `DerivativeGroupQuadsKHR`. A non-generic
  entry point gets the linear mode. The issue names `visitEmptyDecl` → `getAllEntryPointsNoOverride`, which scans
  only global insts, so the decoration inside the `IRGeneric` is missed (read from source, not traced).
- **Filed by:** slang-triager `sess-1786023730364-8w6v1g` (the #12392 owner) after the sibling Main session
  `sess-1794238257695-msauww` OK'd it at 18:40Z ("reproduced and deduped, needs no go-ahead"). Labels
  `GLSL, spirv_vulkan, bug, reproduced`; no assignees at 18:44Z.
- **Routing decision (11-09, issue_opened webhook):** no dispatch. The triager's #12392 report (incl. its G4
  question for tangent-vector) goes to the sibling Main session; that session decides any follow-up.
- **Why no fixer yet:** the code path is the one #12777 tracks and that draft #12721 changes, and tangent-vector
  may fold #12721 into #13882. A separate fix now risks conflicting with that answer. A new fixer chain goes to the
  operator ([[../orchestrator/filing-verified-issues-policy.md]]).
- Parent chain: [[../imported/project_12392_entrypoint_calls_entrypoint_constref_segv.md]].
