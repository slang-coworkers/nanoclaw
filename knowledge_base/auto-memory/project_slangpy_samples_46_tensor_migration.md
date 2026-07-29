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

**⚠️ 2026-07-28 13:32 — "no GPU backend" was STALE; GPU validation NOW POSSIBLE (fixer msg 73534).** Maintainer corrected the fixer: this env **does** have an **NVIDIA L40S + CUDA 12.7** (consistent with the new slang-coworkers L40S host from the 07-17 prod migration). The earlier "gradient-site correctness reasoned-not-run, no GPU backend" caveat (PR body + comment 5061985065) is **superseded** — real functional validation is achievable. **General lesson:** the L40S host means GPU/CUDA runtime validation is available to slang/slangpy coworkers now — don't default to "reasoned-not-run / no GPU" on GPU-dependent work; verify the env first. (Fixer saved a fleet shared-learning on CUDA-vs-Vulkan autodiff + in-container GPU setup — sanctioned propagation path; no Main duplicate needed.)

**✅ 2026-07-28 13:58 — REAL GPU VALIDATION DONE, honestly scoped (fixer msg 73536; codex OUTPUT_REVIEW 3 rounds caught over-claiming + over-attribution, every claim scoped to what was actually run).** Fixer installed **slangpy 0.43.1**, validated on the L40S. Posted results **issuecomment-5105088614**:
- ✅ All **12 migrated modules compile** on the real Slang toolchain (CUDA + Vulkan).
- ✅ **Forward** render dispatches (full image) on **both** CUDA + Vulkan.
- ✅ **CUDA:** training-loop dispatches error-free; the migrated `.store` diff-primitive **backprops to the analytically EXACT gradient (2t)**.
- ⚠️ **Vulkan WATCH ITEM:** auto-generated backward kernel **fails `NVVM compilation failed`** — *looks* toolchain/env-related, **root cause UNCONFIRMED** (fixer did NOT file an issue or over-attribute — correct restraint). If the maintainer's interactive run reproduces it as a genuine Vulkan-autodiff toolchain bug (not env), THAT becomes a fresh slang/slangpy issue — reopen then, don't pre-file on an unconfirmed cause.
- ⚠️ **Full-splat end-to-end gradient NOT verified** — fixer's harness returned 0 grads on the full kernel; cause unresolved (harness/API/bindings/migration — disclosed honestly, not asserted as a migration defect).
- **Next-action:** MAINTAINER runs the sample's own `main.py` interactively (tev display) for the definitive end-to-end check. **PR stays DRAFT.** Blocker: none. Branch `328eb8e` UNCHANGED (all validation was throwaway scratch, removed); worktree clean.
- **State:** the "reasoned-not-run" caveat is now replaced with real, scoped hardware results on the PR (public observability met). Terminal-pending: maintainer interactive run + ready/merge (OP/maintainer-gated). Watch: the Vulkan NVVM finding — if maintainer confirms it's a real bug, spin a new issue; otherwise it's env noise and #46 closes on merge.
