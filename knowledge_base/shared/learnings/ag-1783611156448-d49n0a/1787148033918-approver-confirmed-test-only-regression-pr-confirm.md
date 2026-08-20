---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787145675546-0xabla
written_at: 2026-08-19T14:00:33.918Z
---

# [approver/confirmed] Test-only regression PR: confirm the NEW test ran green in the CI job that actually runs it, not just Devin-clean

**Symptom / class:** A test-only regression PR (adds a test guarding a
previously-reported crash; no production code) authored by a bot. Production
claude-code-action skips bot-authored branches → harvest exit 20 → Devin-only
fallback tier. Devin runs clean (0 findings). The temptation is to approve on
Devin-clean alone.

**Root cause of the false-safe risk:** Devin-clean ≠ test-clean. Devin verifies
on its own machine; it does NOT prove the new test executes green in the
project's actual CI. For a regression-guard PR, "the new test passes in CI" is
the ENTIRE value of the PR — so it is the decisive evidence, and it must be read
from the CI job log, not the PR body (untrusted).

**How to catch it (transferable):**
1. `gh pr checks <pr>` — confirm all checks are complete + green (host CI-gate
   means the head is settled by the time you're woken; still verify not-pending).
2. Identify WHICH job actually runs the new test. In slangpy, the GitHub-hosted
   linux/aarch64 `build(...)` jobs are BUILD-ONLY; the GPU tests run only on the
   self-hosted `nvrgfx-kernelvm-bridge` runners whose matrix rows carry the
   `unit-test` flag (they install torch cu128 + slangpy-torch and run
   `ci.py unit-test-python`). Read `.github/workflows/ci.yml` to map flag→job.
3. `gh run view --repo <repo> --job <jobid> --log | grep <new_test_name>` — the
   new test's parametrizations must show PASSED, not SKIPPED/deselected. Confirm
   the suite summary shows `0 failed`.

For slangpy#1117 this discharged the risk cleanly: `test_scalar_return_with_torch_input`
PASSED on all 4 params (native+fallback × cuda+vulkan) on the CUDA runner; suite
4168 passed / 0 failed. Decision WOULD_APPROVE matched the evidence.

**Also confirmed safe patterns for this file class:**
- torch tests in `test_torchintegration.py` hardcode `device="cuda"` on the
  torch tensor even while parametrizing the slang module over DEVICE_TYPES
  (cuda+vulkan). This is the established convention (the module runs on the
  parametrized device; torch tensors always live on cuda) — NOT a device-gating
  gap. Both device params passed.
- A distinct-per-index discriminator value (`arange*10` → index 3 == 30.0) is a
  real positive control: a silent-zero readback would fail the assert. A
  constant `tensor(0.)` check would not — flag that as weak if you see it.

**Fix / procedure note:** On the Devin-only fallback tier, still do the CI
positive-control read yourself — the fallback verdict mapping (clean→APPROVE) is
only trustworthy once you've confirmed the guarded test genuinely executed green.
