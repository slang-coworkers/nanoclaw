# CI evidence in this repo: tests are STEPS inside build jobs, and three ways a scan lies about them

Verifying a "test passed on device X" claim in shader-slang/slangpy. Cost me and a reviewer four instrument errors in one session — each was a *cheaper proxy* returning a confident wrong answer.

**1. Job-vs-step.** `gh api repos/O/R/actions/runs/<id>/jobs --jq '.jobs[].name'` returns 12 jobs all named `build (...)`, zero named `test`, zero containing `cuda`. Looks like conclusive proof no tests ran. It isn't — **the Python tests run as a *step* inside each build job**: `Typing Checks (Python)` → `Unit Tests (C++)` → **`Unit Tests (Python)`**. A job-name scan structurally cannot see them. Check `gh api repos/O/R/actions/jobs/<job_id> --jq '.steps[]'`. Runners are self-hosted GPU (`labels: Linux,X64,nvrgfx-kernelvm-bridge`), so real CUDA verdicts live in `jobs/<id>/logs`. Corollary: `ci-gcp` having zero runs and `slangpy_torch` last failing months ago are both true and both irrelevant — GPU tests ride in `ci`. **Piling true adjacent facts onto a wrong-granularity probe disguises it instead of repairing it.**

**2. Half the matrix never runs the tests.** Only 6 of 12 build jobs have `Unit Tests (Python)` = `success`; the other 6 (aarch64, x86_64-clang) = `skipped`. So **"the run is green" ≠ "the test ran."** Check per job: `.steps[] | select(.name=="Unit Tests (Python)") | .conclusion`.

**3. The `[NOTSET]` collapse.** A cuda-only-parametrized test renders as `test_foo[NOTSET]` when no CUDA device exists (e.g. macOS), **not** `[DeviceType.cuda]`. So an audit keyed on `[DeviceType.*]` finds *nothing there* rather than a skip — PASSED and SKIPPED are indistinguishable to a device-substring scan.

**4. Your regex is an instrument needing a control.** `test_[a-z_]+\[DeviceType\.` silently drops seed-parametrized ids like `test_apply_changes[1-DeviceType.cuda]`, undercounting 44 → 4. Use `test_file\.py::[^ ]*`. Also: pytest `-v` prints each test **twice** (dispatch line, then verdict line), so a raw grep count doubles. Filter to lines carrying an explicit `PASSED|FAILED|SKIPPED` token and dedupe — "verdict-filtered" is the number to cite.

**Reusable rule:** make the disconfirming check as concrete as the claim it's killing. If the claim names a test, resolve it at the log line naming that test — never at the job list. And a *correction* is the worst possible place for an unverified claim, because its form asserts the checking already happened.
