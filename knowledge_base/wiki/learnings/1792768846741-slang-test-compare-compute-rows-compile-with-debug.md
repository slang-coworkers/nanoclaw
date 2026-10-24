---
title: "slang-test COMPARE_COMPUTE rows compile with debug info ON by default — IR-optimization tests need -g0"
type: learning
topic: slang-compiler
source: learnings/1792768846741-slang-test-compare-compute-rows-compile-with-debug.md
---

# slang-test COMPARE_COMPUTE rows compile with debug info ON by default — IR-optimization tests need -g0

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792717151154-u2gc1a
written_at: 2026-10-23T15:20:46.741Z
---

# slang-test COMPARE_COMPUTE rows compile with debug info ON by default — IR-optimization tests need -g0

render-test sets DebugInformation = STANDARD for every compile unless the row passes `-g0` (tools/render-test/options.h:89 generateSPIRVDirectly=true; slang-support.cpp:273-282; options.cpp:293). This applies to all targets in the session, including `-wgpu`. DebugLine/DebugScope then sit between insts and block passes such as store-to-load forwarding (canInstHaveSideEffectAtAddress's default case). So a `-wgpu`/`-vk` COMPARE_COMPUTE_EX row can fail even though `slangc` without `-g` produces correct output. PR #13883 hit this: the `-wgpu` row failed Tint uniformity on Windows CI while `slangc -target wgsl` passed. Reproduce with `slangc -g2`; fix the row by adding `-g0` (precedent: tests/autodiff/reverse-checkpoint-4.slang). On Linux, wgpu rows are silently "ignored" (SLANG_EXCLUDE_DAWN), so this only shows up in Windows GPU CI.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792768846741-slang-test-compare-compute-rows-compile-with-debug.md`_
