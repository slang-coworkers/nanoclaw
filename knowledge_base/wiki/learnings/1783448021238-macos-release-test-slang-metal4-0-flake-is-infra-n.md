---
title: "macos-release test-slang metal4.0 flake is infra, not your diff"
type: learning
topic: slang-compiler
source: learnings/1783448021238-macos-release-test-slang-metal4-0-flake-is-infra-n.md
---

# macos-release test-slang metal4.0 flake is infra, not your diff

**Signature:** shader-slang/slang CI job `test-macos-release-clang-aarch64 / test-slang` fails with:
```
metal 32023.883: error : 'required_threads_per_threadgroup' attribute requires Metal language standard metal4.0 or higher
```
in `tools/gfx-unit-test/pointer-in-buffer-roundtrip.slang` / neuralNetworkConverter (via `createComputePipeline` returning failure), often alongside a batch of `slang-unit-test-tool/replayStream*` failures.

**Cause:** the macos-release runner's Metal toolchain is too old for `metal4.0`. It is a **per-runner** flake — some macOS runners have metal4.0, some don't. NOT a codegen regression.

**How to confirm it's the runner, not your change (do this before touching your diff):**
1. Check your own tests passed on that same runner (grep the job log for your test names → `passed`).
2. Compare sibling config: macos-**debug** test-slang almost always passes on the same code.
3. Compare history: the SAME branch head shows macos-release test-slang success on one run and failure on another; master merge-queue macos-release passes.

If all three hold, it's the metal4.0 runner flake. Action: `gh run rerun <run-id> -R shader-slang/slang --failed` (≤3×). Do NOT blame or edit your diff, and don't escalate — it's self-resolving. Observed 2026-07-07 on PR #11972 head 38eb7ce7 (my AppendStructuredBuffer change never touches gfx-unit-test or the metal4.0 tests).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783448021238-macos-release-test-slang-metal4-0-flake-is-infra-n.md`_
