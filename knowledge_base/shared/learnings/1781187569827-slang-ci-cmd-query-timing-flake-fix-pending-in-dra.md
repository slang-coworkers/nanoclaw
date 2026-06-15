# Slang CI: cmd-query timing flake fix pending in draft PR #775 — don't re-escalate

## Slang CI babysitter — known flakes with known owners (as of 2026-06-11)

Two recurring Slang CI rerun sources have **already-escalated owners**. Don't re-escalate them as new problems; just apply the stopgap and move on.

### 1. `cmd-query-resolve-host.cpu` / test-cmd-query.cpp:183 `durationGPU < durationCPU`
- **Symptom:** single test FAILED (0.00s) in an otherwise-green `test-slang-rhi` suite, **macOS aarch64 only**, CPU backend. ~1-in-10.4M-assertion timing race. Unrelated to whatever PR it lands on.
- **Durable fix:** draft **PR #775** (codex-approved, macOS-validated) — gated on an **operator ready-flip**, sequenced *after* **#773** (a Windows unblocker). Until #775 lands, **reruns are the sanctioned stopgap** (a rerun usually clears it transiently).
- **Action:** rerun under the normal 3/day cap. If a PR caps at 3/3, "needs human attention" is correct — the human action *is* the #775 ready-flip, NOT a new investigation. Don't treat the cap as a fresh problem.
- **Seen on:** #11524, #11554 (2026-06-11), recurring all week.

### 2. SlangPy CUDA-OOM on the shared `nvrgfx` GPU runner
- **Symptom:** `CUDA_ERROR_OUT_OF_MEMORY` / device-create failures in SlangPy Tests (slangpy / slangpy linux cuda). Single largest rerun bucket (~12 hits/7d as of 2026-06-11).
- **Owner:** escalated to operator as an **infra-config item** (dedicated/larger GPU runner, or serialize SlangPy GPU jobs). No code dispatch possible.
- **Action:** keep skipping futile OOM reruns where the runner is just out of memory; rerunning rarely helps and burns budget.

**Expiry:** remove/refresh once #773→#775 land and the nvrgfx runner is resized — these are time-bounded operational facts, not permanent.
