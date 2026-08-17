---
title: "CORRECTION slang#11999 — the 'conflated' metal4.0 signature WAS the root cause; don't dismiss without the reproducing env"
type: learning
topic: slang-compiler
source: learnings/1784185814547-correction-slang-11999-the-conflated-metal4-0-sign.md
---

# CORRECTION slang#11999 — the "conflated" metal4.0 signature WAS the root cause; don't dismiss without the reproducing env

**This corrects my earlier learning "slang#11999 gpu-printing macOS flake — verify CI signature, don't trust bot conflation." That learning's core reclassification was WRONG.** Keep the verify-the-logs discipline; discard the "bot conflated two signatures" conclusion.

**Resolution (settled 07-15):** PR #12009 MERGED (a2596654). It grew from my instrumentation-only diff to also **revert the quarantine (#11995) AND carry the real compiler fix** (aba3cd7d "Metal: derive downstream `-std` from the target metallib capability"). Issue closed by jkwak.

**Real root cause:** the emitter gates `[[required_threads_per_threadgroup]]` on `metallib_4_0`, but the downstream Metal compile hardcoded `-std=metal3.1`. The Metal compiler rejected the version-gated syntax → `createComputePipeline` returned null → `execute()` SLANG_FAIL → exit 255. Fix: set `-std=metal4.0` when target caps imply `metallib_4_0`.

**Where my triage went wrong:**
1. I saw the metal4.0 `required_threads_per_threadgroup` errors only in the GREEN "Test Slang" step (gfx-unit-tests), saw gpu-printing fail SILENTLY (exit 255, no diagnostic) in the RED examples step, and asserted they were DIFFERENT signatures — "the bot conflated a non-fatal signature with the gpu-printing failure." **That assertion exceeded the evidence.** The SAME mechanism (metal4.0-gated syntax vs hardcoded -std=metal3.1) drove BOTH. A shared mechanism legitimately surfaces in two different tests.
2. I treated the intermittency (~4 pass / ~15 fail on same-era master) as strong evidence AGAINST a deterministic Slang bug. But hosted macOS runners have a **heterogeneous Metal toolchain fleet** — some instances had metal4.0-capable toolchains that accepted the syntax, some didn't. So it was deterministic-given-the-toolchain, only *appearing* intermittent across the fleet. jkwak's "a simple example should run regardless of OS — it's a Slang bug" instinct was correct.

**What went RIGHT (keep doing this):** because gpu-printing swallowed the failure silently, I could NOT see the real stage from logs — and instead of guessing, I recommended **instrument-first** (report the failing RHI stage + enable RHI debug layers). That is exactly what surfaced ground truth and led to the real fix. The process was sound; the over-confident reclassification was the error.

**Lessons:**
- A shared mechanism can appear in two tests / two steps. Don't dismiss a plausible root cause as "conflated / unrelated" unless you have the environment that actually reproduces it and shows otherwise.
- When a failure is SILENT, "I can't tell which mechanism" is the honest verdict — recommend instrumentation to ground truth; do NOT additionally assert what it is NOT.
- Apparent intermittency across a heterogeneous hosted-runner fleet can be deterministic-per-toolchain. "Passes on some runners" ≠ "environmental, not a compiler bug."
- A maintainer's "it's a compiler bug regardless of OS" instinct deserves weight; treat it as a hypothesis to instrument toward, not to rebut from silent logs.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784185814547-correction-slang-11999-the-conflated-metal4-0-sign.md`_
