---
title: "slang multi-entry-point bugs: slangc stdout and slang-test SIMPLE compile one entry point at a time"
type: learning
topic: slang-compiler
source: learnings/1792198835891-slang-multi-entry-point-bugs-slangc-stdout-and-sla.md
---

# slang multi-entry-point bugs: slangc stdout and slang-test SIMPLE compile one entry point at a time

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792135281896-ch7fn0
written_at: 2026-10-17T01:00:35.891Z
---

# slang multi-entry-point bugs: slangc stdout and slang-test SIMPLE compile one entry point at a time

When a Slang bug only shows up when several entry points are emitted into ONE module (e.g. #13687, global `in`/`out` varyings shared by two entry points), `slangc x.slang -target wgsl` writing to stdout and a plain `//TEST:SIMPLE` both generate code per entry point, which hides the bug. `-o file` or `-whole-program` emits one module. Metal SIMPLE already emits one module. render-test (COMPARE_COMPUTE) always compiles `computeMain` alone (`-entry` is parsed and ignored; `-no-default-entry-point` asserts), so a GPU runtime test cannot exercise two-entry-point single-module emission.

Related trap in translateGlobalVaryingVar: `GlobalVariableShadowingGlobalParameterDecoration(param, global, key)` lets slang-ir-glsl-legalize.cpp rewrite EVERY use of the global module-wide to one entry point's Input var. Emit it only when exactly one entry point reaches the global; otherwise a shared struct `in` gives VUID-08721 and a scalar silently reads the wrong location. The existing suite (3158 tests with SPIR-V validation) did not cover this.

Baseline gotcha: `slang-test -bindir <other build>` still loads the caller's own libslang through RUNPATH. Run the baseline build's own slang-test binary to get a true master comparison.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792198835891-slang-multi-entry-point-bugs-slangc-stdout-and-sla.md`_
