---
title: "Reconciling Slang CI test-silencing follow-ups (expected-failure lists) + the workflows-perm coordination trap"
type: learning
topic: slang-compiler
source: learnings/1780769333040-reconciling-slang-ci-test-silencing-follow-ups-exp.md
---

# Reconciling Slang CI test-silencing follow-ups (expected-failure lists) + the workflows-perm coordination trap

From slang#11500 investigation (2026-06-06): a follow-up issue asking how to permanently treat four Vulkan `gfx-unit-test-tool` tests that an open PR (#11497) silenced on aarch64 via a new `tests/expected-failure-aarch64.txt`. Reusable facts for the next coworker handling CI-silencing reconciliation:

**1. Where no-GPU Vulkan tests get silenced + the wiring.** `tests/expected-failure-no-gpu.txt` already lists ~24 Vulkan `gfx-unit-test-tool/<name>.internal` entries under `# Vulkan gfx-unit-tests require a Vulkan-capable GPU`. `.github/workflows/ci-slang-test.yml:133` appends that list whenever `full-gpu-tests != true`. Linux aarch64 jobs set `full-gpu-tests: false` (`ci.yml`), so they ALREADY consume no-gpu.txt — appending entries there is the established, lowest-friction way to silence a no-GPU test (vs. a per-arch file). macOS aarch64 jobs are `full-gpu-tests: true`, so they do NOT consume no-gpu.txt — scope "aarch64 already consumes it" to the *Linux* aarch64 jobs.

**2. expected-failure matching mechanics (verified).** `tools/slang-test/options.cpp:~519` parses the list (trim whitespace, strip `#` comments, store strings); `tools/slang-test/test-reporter.cpp:168` matches those strings against `m_currentInfo.name` by EXACT normalized path string. A typo'd entry silently fails to match → CI stays red. Also: expected-failure RUNS the test then reclassifies a failing exit → ignored; it CANNOT suppress a test that crashes/SIGSEGVs the worker. So Approach-A-style silencing only works if the tests fail *cleanly* (clean SLANG_FAIL), which you can confirm if the PR's own aarch64 job is green with them listed.

**3. The "aarch64-specific vs generic no-GPU" tell.** Don't assume a test silenced on aarch64 fails for the generic "no GPU" reason. Cross-check the x86_64 sanitizer job (no-GPU, `-api all`, consumes no-gpu.txt): if it's GREEN *without* the tests listed, `SLANG_IGNORE_TEST` is sufficient on x86_64 and the failure is specific to the aarch64 runner's Vulkan environment (loader present, ICD absent → fails PAST the `createTestingDevice`/`SLANG_IGNORE_TEST` skip in `tools/gfx/vulkan/vk-device.cpp`). Folding into no-gpu.txt still works (harmless no-op on x86_64) but files them under a slightly broader label — say so honestly and offer `-api all -api -vk` on aarch64 as a fallback.

**4. The coordination trap (the load-bearing one).** nv-slang-bot[bot] lacks the `workflows` GitHub App permission and CANNOT push `.github/workflows/*`. So when a reconciliation requires removing CI workflow plumbing (a per-arch conditional, a list-application line), a *bot-authored follow-up PR is mechanically incomplete* — it can edit `tests/*` but leaves dangling workflow YAML pointing at a deleted file. When the silencing PR is still OPEN and owned by the same author, the clean path is to recommend the author AMEND THEIR PR IN PLACE (single PR, they can edit workflows), surfaced as an ask-don't-assert GitHub comment with a markdown-checklist of options — NOT a competing bot PR. Always check the `workflows`-perm constraint before proposing "ship a follow-up PR" for any CI-config change.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780769333040-reconciling-slang-ci-test-silencing-follow-ups-exp.md`_
