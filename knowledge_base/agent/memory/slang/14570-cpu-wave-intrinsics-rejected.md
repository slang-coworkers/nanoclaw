---
type: project
title: "slang#14570 — CPU targets reject all wave intrinsics (wave-of-one proposal)"
description: "Human issue (albertrodriguezclo): wave intrinsics all fail E36107 on C++ CPU targets though each thread could be a wave of one lane. TRIAGED 11-18: root cause = subgroup_* capability aliases exclude cpp (capdef:2579+); CPU dispatch is sequential, wave-of-one factually correct. Parked on assignee jhelferty-nv (bless semantics + scope, WaveReadLaneAt(lane≠0), interaction with #8244). Recommended fix approach A (add cpp disjuncts + single-lane bodies). One-shot re-check 2026-11-25 02:30Z (triager-armed). No fixer until maintainer go."
---

**Issue #14570** (albertrodriguezclo, human, open; assignee jhelferty-nv; label `reproduced` +
Type=Feature): "C++ CPU targets: wave intrinsics are all rejected, though each thread could be a
wave of one lane."

**2026-11-18 02:20Z triaged + parked (triager [Triage]; Main-verified artifacts: comment
[6967058645](https://github.com/shader-slang/slang/issues/14570#issuecomment-6967058645)
nv-slang-bot 02:20:50Z, label live, assignee live).**

- **Root cause (verified on master `a7ea5f853`, fresh build):** all wave intrinsics require
  target-sets/capability aliases that exclude `cpp` (`subgroup_*` capdef:2579–2679 no cpp disjunct)
  → E36107 in `validateEntryPointCapabilities` (slang-check-shader.cpp:1885). CPU dispatch is
  sequential per-thread loops (slang-emit-cpp.cpp:2221) — wave-of-one semantics factually correct
  today; no Wave handling anywhere on the CPU emit path.
- **Solution space:** (A) **recommended** — add `| cpp` to
  subgroup_basic/vote/ballot/arithmetic/shuffle aliases + `case cpp:` single-lane bodies in
  hlsl.meta.slang:17785–19661 (shaderclock/atomic64 precedent; internal `_WaveCountBits` already
  anticipates cpp). (B) IR lowering pass for waveMask ops — overkill. (C) capability-only widening —
  NOT viable: `default:` fallbacks strand WaveMask IR ops with no CPU lowering → broken codegen.
- **Classification:** enhancement / medium / frontend (capability system + core module) / P2 · not a
  dup (related: #8244 SIMD-CPU proposal, #14249 GLSL subgroup gaps).
- **Decision owner: jhelferty-nv** (MEMBER assignee) — bless wave-of-one semantics + scope, incl.
  `WaveReadLaneAt(lane≠0)` behavior and interaction with #8244. Triage comment posted naming him
  with the full fix brief. **Parked, no fixer dispatched** (external feature request proposing new
  target semantics — maintainer go-ahead first per policy).
- **Timer:** triager-armed one-shot re-check **2026-11-25 02:30Z**. Memo + chain state in triager's
  memory/issues/{triage-14570,14570}.md; triage memo also in Main inbox
  (a2a-1794968439572-c9gwft). Domain note added by triager: cpp-target capability gating.

Resume on: jhelferty-nv's reply (webhook + the re-check), maintainer go-ahead → fixer with approach A.
