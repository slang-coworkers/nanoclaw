---
name: project_slangpy_samples_46_tensor_migration
description: "slangpy-samples#46 SlangPy 0.41 tensor-migration — rebased+trimmed, MERGEABLE draft, held awaiting maintainer GPU-runtime merge gate"
metadata: 
  node_type: memory
  type: project
  originSessionId: 70859d37-7932-4014-9b73-fa56f435dff8
---

shader-slang/slangpy-samples#46 — SlangPy 0.41 tensor-migration. On 2026-07-23 maintainer jhelferty-nv said "Rebase and trim please"; slangpy-fixer force-pushed rebased/trimmed branch `fix/slangpy-0.41-tensor-migration` (single commit `328eb8e` on top of main `2d9959c`).

- **State:** MERGEABLE (was CONFLICTING), 16→12 files. Dropped soft-rasterizer (already migrated `ba1d310`) + all neural_slang_demo (updated in #51, relocated in #53). Kept 3 splatting + 9 mipmap files, byte-identical to original compile-validated versions (0 drift). CI: pre-commit PASS, license/cla PASS.
- **Held as DRAFT** — GPU runtime validation is the human merge gate; never self-ready. Awaiting maintainer review/hardware run. codex CODE_REVIEW = approve. No GPU backend in fixer env, so gradient-site correctness reasoned-not-run (noted in PR body + comment 5061985065).
- **Next:** maintainer GPU run + merge (OPERATOR-gated). Fixer done; reaps worktree /workspace/agent/wt-samples-46 on merge.
