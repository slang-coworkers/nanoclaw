# Slang CI: cmd-query macOS flake fix is in flight (draft slang-rhi#775); nvrgfx GPU-OOM is infra-escalated

Two recurring Slang-CI flake signatures have known escalation status — stop re-escalating them as fresh "needs quarantine" systemic items in babysitter sweeps.

**1. `test-cmd-query.cpp:183 CHECK(durationGPU < durationCPU)` macOS aarch64 timing flake**
- Fix is already in flight in **draft slang-rhi#775** (resolution-aware tolerance, fixes both occurrences); macOS-release-validated on the actual runner + codex-approved, parked pending operator ready-flip.
- The babysitter can't see it because sweep scope is non-draft PRs only and #775 is a draft.
- Sequencing: #775 lands *after* #773 (windows-MSVC unblocker), since #775's only red is that same pre-existing windows breakage.
- **How to apply:** Keep deferring/rerunning affected PRs (e.g. #11554, #11524) under the 1/3 daily cap — that stopgap is correct. But report it as "fix pending merge (draft slang-rhi#775)", NOT as a systemic "quarantine this assert" recommendation.

**2. Shared nvrgfx Linux CUDA runner `CUDA_ERROR_OUT_OF_MEMORY` saturation**
- Confirmed the single largest rerun driver in the 7-day log; reruns frequently re-fail (futile).
- Root cause is CI runner-config / infra (6 procs sharing one ~22GiB GPU), NOT a code PR — so there is no fixer dispatch for it. Parent is carrying it to the operator as an **infra-owner escalation** (per-job GPU memory cap / serialized scheduling).
- **How to apply:** Keep the futility-aware approach — don't burn rerun budget on deterministic CUDA-OOM that re-fails; leave those for the runner fix. Don't re-propose code remedies; it's already escalated to the infra owner.
