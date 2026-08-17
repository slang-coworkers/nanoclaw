---
title: "Slang CI: cooperative-vector hlsl-codegen tests fail on Windows-release-GPU pre-#11358"
type: learning
topic: slang-compiler
source: learnings/1780157118768-slang-ci-cooperative-vector-tests-fail-on-windows-.md
---

# Slang CI: cooperative-vector hlsl-codegen tests fail on Windows-release-GPU pre-#11358

## Symptom

`test-windows-release-cl-x86_64-gpu / test-slang` fails with these two specific tests on **multiple unrelated PRs**:

- `tests/cooperative-vector/matrix-mul-hlsl-codegen.slang.1`
- `tests/cooperative-vector/training-hlsl-codegen.slang.1`

CHECK-DAG mismatch: tests expect `dx::linalg::VectorAccumulate(...)` but DXC emits `dx::linalg::InterlockedAccumulate(...)`. Failures are deterministic — they survive the slang-test built-in 3-attempt retry, so this is **not** a GPU flake.

## Why it looks platform-flake but isn't

- Single-platform: only `windows-release-cl-x86_64-gpu`. All Linux / macOS / Windows-debug runners pass (these tests gate to that runner).
- Hits PRs that don't touch cooperative-vector code at all — docs PRs, CI cleanup, autodiff PRs, raytracing volatile-semantics PR.
- 2026-05-29→30 sweeps observed the exact same pair failing across **8 unrelated open PRs** (e.g. #11363, #11355, #11332, #11331, #11265, #11344, #11336).

Across-PR reproducibility on a single runner type points at master state, not random GPU flake.

## Root cause / fix in flight

The Windows-release-GPU runner has a DXC version that emits `InterlockedAccumulate` instead of the previously-emitted `VectorAccumulate`; the test goldens / Slang emit code need to be aligned, which is what **PR #11358 "Complete DXC cooperative vector revert"** does. Confirmed still **OPEN** as of 2026-05-31. Until it lands, every PR branched from the affected master commit will fail these two tests.

## Action for the CI babysitter

1. **Do NOT `gh run rerun --failed`** on this signature — same outcome will recur, wastes Windows-GPU runner time and the daily rerun budget.
2. Classify as "blocked on #11358", not "flake" and not "code regression in this PR".
3. Note in the PR thread (or sweep summary) that the fix is queued, not the PR's responsibility.

## Quick detection signature

If you see the SAME 2 cooperative-vector tests failing on `test-windows-release-cl-x86_64-gpu` across 3+ PRs in the same sweep, it's this issue. The `.1` suffix indicates the DX12 variant — fits the "DXC cooperative vector revert" framing (DXC is the DX12 shader compiler).

## When this learning expires

Once #11358 merges and PRs rebase, this signature should disappear. **Delete this learning** at that point.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780157118768-slang-ci-cooperative-vector-tests-fail-on-windows-.md`_
