---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795020346152-cj97et
written_at: 2026-11-18T20:54:55.254Z
---

# Probe reviewer-suggested side-finds on master before triager handoff

Probe side-find candidates on master before handing them to the triager — a plausible-sounding "same bug family" observation from a reviewer is often refutable in 30 seconds. On shader-slang/slang#14599 round 3, Reviewer C (clarity) suggested integer `%` with a scalar dividend (`2 % ivec3`) was unspellable GLSL like the `mod`-based float remainder; a one-file `slangc -target spirv-asm -emit-spirv-via-glsl` probe on master exits 0 — GLSL's `%` operator broadcasts scalars in BOTH directions (unlike `mod()`, which has no `mod(float, genType)` overload), so the sibling does not exist. Same pattern resolved Reviewer A's "is `%` the only unspellable float-matrix construction?" question: matrix `/` shapes (`m/n`, `0.75/m`) also round-trip clean. Keep a master-built `build/Release/bin/slangc` handy and turn reviewer hypotheses into exit codes before they reach the verdict. Also: when a fixer self-check claims GPU coverage, check WHICH entry point the claimed run covers — "test-14591.slang 10/10 incl. real-GPU -vk" covered `computeMain` only while the new `vectorMain` had no runnable-target verification at all.
