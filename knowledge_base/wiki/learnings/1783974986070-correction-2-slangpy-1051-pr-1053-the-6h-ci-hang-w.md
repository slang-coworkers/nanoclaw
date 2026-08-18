---
title: "CORRECTION #2 (slangpy#1051/PR#1053): the 6h CI hang was the known CUDA-OOM cascade, NOT the crashing test"
type: learning
topic: slang-compiler
source: learnings/1783974986070-correction-2-slangpy-1051-pr-1053-the-6h-ci-hang-w.md
---

# CORRECTION #2 (slangpy#1051/PR#1053): the 6h CI hang was the known CUDA-OOM cascade, NOT the crashing test

Supersedes my two earlier notes that blamed a deliberately-crashing GPU test for the slangpy#1053 CI hang. The controls-ONLY version of the test (all crash/subprocess machinery removed — just two ordinary `.bwds()` GPU tests that pass locally in ~4s) STILL hung the x86_64 gcc/msvc "Unit Tests (Python)" step for 6h. That disproves the crash-test theory.

**Actual root cause (high-confidence):** the SlangPy self-hosted nvrgfx GPU runners run `pytest -n auto --maxprocesses=4`; 4 concurrent workers each open CUDA+Vulkan(+D3D12)+torch CUDA context, exhausting VRAM → a **CUDA-OOM cascade** that hangs/fails the Python step (documented verbatim in commit `7b16ae0`, "ci: halve GPU test worker cap to mitigate CUDA-OOM cascades", on branch `ci/cap-gpu-test-workers`, which lowers the cap to 2). `origin/main` did NOT have this mitigation, so PRs based on it can hit the hang; it presents as the x86_64 gcc/msvc lanes stuck `in_progress` for hours while clang lanes (which SKIP the Python step in this matrix) look fine, and aarch64 lanes pass.

**Lessons:**
1. A 6h hang in "Unit Tests (Python)" on the x86_64 GPU lanes is most likely infra (VRAM/OOM), NOT your diff. Check `tools/ci.py` `--maxprocesses` and whether the OOM-cap mitigation is in your base BEFORE assuming your test is the cause.
2. "Only my branch hangs" is NOT proof it's your content — it can be an intermittent infra hang your branch keeps landing on while siblings get lucky. Confirm by reducing YOUR change to the minimum (here: strip to controls-only / docs-only) and seeing if the hang persists. It did → not my content.
3. Don't iterate speculative fixes through a 6h CI cycle. If you cannot reproduce locally (crashpad off locally; can't replicate the multi-worker GPU-runner VRAM pressure), reduce your change to near-zero and/or escalate to whoever owns the CI infra branch, rather than burning cycles. I burned ~4×6h before finding the OOM commit.
4. Check for an existing infra-mitigation branch (`git log --all --grep=OOM|worker|cap|flaky`) early.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783974986070-correction-2-slangpy-1051-pr-1053-the-6h-ci-hang-w.md`_
