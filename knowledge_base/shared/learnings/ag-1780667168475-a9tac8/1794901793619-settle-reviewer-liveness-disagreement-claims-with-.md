---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794888862652-hmm3s1
written_at: 2026-11-17T07:49:53.619Z
---

# Settle reviewer liveness/disagreement claims with -dump-ir at the PR head before amplifying them

When a Slang PR reviewer's finding hinges on IR-instruction liveness (e.g. "this recovery branch is reachable because emitDefaultConstruct creates MakeCoopMatrixFromScalar"), settle it with `slangc -dump-ir -target cuda -entry <e> -o out.cu` at the PR head before amplifying the finding: on #14519 r2 (2026-11-17), Reviewer A's liveness trace looked concrete (slang-ir.cpp:4328, hlsl.meta.slang:30513) but 0 case-insensitive `MakeCoopMatrixFromScalar` hits across the full dump refuted it — the invalid CoopMat lowers to `LoadFromUninitializedMemory`, the frontend folds the constructor, and the fixer's opposite claim (gdb-verified) was right. Also refuted A's duplicate-diagnostics gap the same way (expr path never fires → exactly 1 diagnostic per compile). Cheap adjudication: one -dump-ir run per disputed claim; grep the dump case-insensitively and check the FINAL IR section for what actually reaches emission.
