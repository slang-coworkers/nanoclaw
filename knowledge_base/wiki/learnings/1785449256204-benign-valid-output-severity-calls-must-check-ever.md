---
title: "Benign/valid-output severity calls must check every reachable emit target (validity is target-specific)"
type: learning
topic: ci-tooling
source: learnings/1785449256204-benign-valid-output-severity-calls-must-check-ever.md
---

# Benign/valid-output severity calls must check every reachable emit target (validity is target-specific)

## Rule

When rating a codegen/emit behavior change as **"benign"** or **"produces valid output,"** the assessment MUST hold on **every reachable emit target**, not just the one(s) tested. Type/IR-shape validity is **target-specific** — a construct that is valid on one backend can be a hard error on another.

## The why (concrete incident, slang #11917 batch-3 / PR #12281, 2026-07-30)

An early-out gate change caused a **public empty struct** on a resource-free module to be **kept** (not stripped) where master stripped it. This was assessed **benign** by the fixer, the peer reviewer (as finding "F1"), triage, and codex's round-1 CODE_REVIEW — all concurred "redundant/benign," and Main relayed it as "source-verified safe."

It was a **real regression**. The "benign" call rested on *"a 0-member `OpTypeStruct` is valid SPIR-V"* — **true for direct SPIR-V, but empty structs are illegal GLSL syntax.** On `-emit-spirv-via-glsl` the kept `struct Empty_0 {}` made glslang fail with `syntax error, unexpected RIGHT_BRACE` where master compiled. pdeayton-nv's "test it through glslang" probe caught what four reviewers missed.

Root cause of the miss: the byte-identity/validity checks only covered the **tested** targets (plain non-public empty struct on HLSL/CPU + direct SPIR-V). "Verified at source" and "byte-identical on the cases I ran" do **not** cover untested emit targets.

## How to apply

- Before calling an emit-affecting change "benign / valid output," enumerate the reachable targets (HLSL, GLSL / `-emit-spirv-via-glsl`, direct SPIR-V, Metal, WGSL, CUDA/PTX, CPU/C++) and confirm the claim on each — especially the ones with **stricter source-language syntax** (GLSL rejects empty structs; WGSL/Metal reject bool switch selectors and `i32(bool)`; CUDA/PTX reject stray keywords). Empty/0-member aggregates, bool-typed constants, and pointer-as-param are common target-divergent shapes.
- Prefer an **adversarial cross-target probe** ("compile this through glslang / naga / NVRTC") over reasoning from one backend's validity.
- A reviewer's severity floor should treat "valid on the target I checked" as **not** equal to "valid everywhere it's emitted." When unsure, rate it a gap and name the untested target, don't round down to benign.

Related: the slang #12260 `enum:bool` fix had the mirror shape — a target-agnostic front-end fold made a switch reach *every* backend's emit, exposing per-target legalization gaps (WGSL had no bool-switch legalization). Same class: one change, N emit targets, validity differs per target.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785449256204-benign-valid-output-severity-calls-must-check-ever.md`_
