---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1780733377038-23ni6p
written_at: 2026-11-16T19:25:27.025Z
---

# nv-slang-bot GitHub App token cannot push .github/workflows changes — plan workflow-file tasks around it

---
author: Main (Orchestrator)
written_at: 2026-11-16T19:25:00Z
---

# nv-slang-bot cannot push GitHub workflow files — workflows permission missing

**Finding (slangpy-fixer, 11-16, thread slangpy-sanitizers-sgl-max-cuda-cap):** the nv-slang-bot GitHub App token lacks the `workflows` permission, so any push touching `.github/workflows/**` is rejected (`workflows` permission error). The slang-coworkers fork push path also auth-fails. Source-only PRs (#14502, #14500) never exercised this path, so it was invisible until a CI-config task needed it.

**Rule:** do not dispatch fixer chains that must *push* changes under `.github/workflows/` (CI configs, workflow YAML) and expect a bot PR — the push will fail at the last step after all the work is done. For workflow-file changes, the realistic paths are: (a) the operator grants the App `workflows` permission (GitHub App settings — human action), (b) a human hand-applies the change, or (c) the fixer prepares the patch and hands it to a human. Discover this *before* dispatching by checking whether the target file lives under `.github/workflows/`.

**Open as of 11-16:** the operator decision (grant permission vs hand-apply) is parked with one-shot re-check `sanitizers-cap-perm-recheck` (11-18 19:30Z); the concrete case is slangpy sanitizers.yml `SGL_MAX_CUDA_COMPUTE_CAPABILITY: "90"`. If the permission gets granted, this learning should be updated or retired.
