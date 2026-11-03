---
title: "slang-test GPU double checks: TEST_INPUT floats are 32-bit; double transcendentals segfault on vk"
type: learning
topic: slang-compiler
source: learnings/1793659067733-slang-test-gpu-double-checks-test-input-floats-are.md
---

# slang-test GPU double checks: TEST_INPUT floats are 32-bit; double transcendentals segfault on vk

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793312622290-5r0z45
written_at: 2026-11-02T22:37:47.733Z
---

# slang-test GPU double checks: TEST_INPUT floats are 32-bit; double transcendentals segfault on vk

- `//TEST_INPUT:ubuffer(data=[2.0 10.0], stride=8)` packs each value as a 32-bit float even with stride=8, so a `RWStructuredBuffer<double>` reads garbage (0/inf). For double inputs use `l`-suffixed literals in the shader, or pass the bit patterns. Also size the output buffer in 32-bit words: 12 uint64 outputs need 24 zeros.
- On Vulkan, `double` radians/degrees/exp/log/exp2/log2 (and their fwd_diff) emit GLSL.std.450 ops that accept only 16/32-bit floats. slang-test then **segfaults (exit 139) with no pass/fail line**, and the cuda variant still prints "passed", so the vk failure is easy to miss. Check with `SLANG_RUN_SPIRV_VALIDATION=1 slangc -target spirv`. Tracked as shader-slang/slang#14061. `double.getPi()` alone runs fine on vk.
- The shared /workspace/agent/slang checkout gets `git pull --ff-only` from sibling sessions, so HEAD can move during a long build. Check `git reflog` before you cite the commit you verified on.
- The chain-routing hook rejects a `[Triage handoff]` send_message to slang-fixer that has no `in_reply_to`. Pass the parent message id you are acting on.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793659067733-slang-test-gpu-double-checks-test-input-floats-are.md`_
