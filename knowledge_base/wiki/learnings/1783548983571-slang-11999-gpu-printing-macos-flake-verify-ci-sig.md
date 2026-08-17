---
title: "slang#11999 gpu-printing macOS flake — verify CI signature, don't trust bot conflation"
type: learning
topic: ci-tooling
source: learnings/1783548983571-slang-11999-gpu-printing-macos-flake-verify-ci-sig.md
---

# slang#11999 gpu-printing macOS flake — verify CI signature, don't trust bot conflation

When triaging a CI-quarantine dispute, pull the ACTUAL failing-job logs and identify which *step* is red — the bot's summary can conflate distinct signatures.

**Case (#11999, gpu-printing on hosted macOS aarch64):**
- The red step was **"Run Slang examples"** where `gpu-printing` exits **255 with zero output**. The sibling **"Test Slang" step was GREEN** in the same jobs.
- The bot's cited root cause — `required_threads_per_threadgroup` / `metal4.0` / `createComputePipeline E40003` — was actually on **gfx-unit-tests inside the green Test Slang step**, a *different, non-fatal* signature. #11973 lumped it together with the gpu-printing example failure. Two problems, one issue.
- Exit 255 = example's `exampleMain` returning -1 = `execute()` returned SLANG_FAIL. With **no Slang diagnostic printed**, a compile/codegen error is ruled out → the failure is an RHI null-return (createDevice/createShaderProgram/createComputePipeline). The example *swallows* it silently.
- **Intermittent, not deterministic:** on unchanged master (static for ~18h) gpu-printing both passed (~4 runs, prints "hello from thread 0..31") and failed (~15 runs) within the same hours. This refutes a deterministic Slang codegen bug.
- **But** in a failing job, 3 sibling Metal-device examples (platform-test/shader-toy/triangle, each logging `GPUFamilyApple6 not supported` = device created) **passed on the same runner instance** → refutes "device creation dead on this instance" too. Runner = virtualized **"Apple Paravirtual device"** (`macos-latest`).
- **"Debug passes / release fails" is a CI-config artifact**, not a bug property: examples run only on `config==release && event==pull_request` (ci-slang-test.yml:167). ci-examples.sh has NO retry logic (run_sample runs once).

**Takeaways for future CI triage:**
1. Map the red to a specific *step* + specific example/test before accepting any root-cause narrative.
2. Test determinism explicitly: scan multiple runs of the SAME (or same-era) code — pass-AND-fail within an hour = intermittent, which reframes both "env flake" and "deterministic bug" claims.
3. A silent `return SLANG_FAIL` in an example is un-diagnosable — recommend instrumenting the failure point before asserting env-vs-compiler.
4. Correlate onset with dependency bumps (here: slang-rhi ToT bump #11960, 07-06).

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783548983571-slang-11999-gpu-printing-macos-flake-verify-ci-sig.md`_
