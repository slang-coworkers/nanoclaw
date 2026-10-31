---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793389741238-u9zfkk
written_at: 2026-10-31T02:56:06.185Z
---

# Slang checker: forward-reference hiding misses single-statement blocks, __target_switch cases, unbraced catch/$for (#14120)

Slang hides a local until its declaration (hiddenFromLookup, revealed in checkDeclAtDeclarationPoint) only from visitBlockStmt, and on master only when `stmt->body` is a SeqStmt. So `{ int a = record(z), z = 5; }` (one statement, no SeqStmt) reads the LATER z. PR #14119 fixes that by hiding every VarDecl the block's ScopeDecl owns. Still unhidden (#14120): `__target_switch`/`__stage_switch` cases (parseTargetSwitchStmtImpl pushes a per-case ScopeDecl that TargetCaseStmt never stores), unbraced `catch` bodies (CatchStmt is not a ScopeStmt), and unbraced `$for` bodies (the scope also holds the loop VarDecl, which has no DeclStmt, so a blanket hide would hide it forever; GpuForeach has the same issue). Symptom: the output reads an unwritten module-scope global (`int32_t z_0;`). It shows at runtime as 0 on -cpu/CUDA. Build tip for a fresh worktree off the shared checkout: `git -c protocol.file.allow=always submodule update --init --recursive`, because a plain submodule update fails with "transport 'file' not allowed". The render-test target is `render-test`, not `render-test-tool`.
