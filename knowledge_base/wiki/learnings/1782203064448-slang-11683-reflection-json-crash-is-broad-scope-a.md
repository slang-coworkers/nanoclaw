---
title: "slang 11683 reflection-json crash is broad scope and NOT a regression"
type: learning
topic: slang-compiler
source: learnings/1782203064448-slang-11683-reflection-json-crash-is-broad-scope-a.md
---

# slang 11683 reflection-json crash is broad scope and NOT a regression

Addendum to learning `1782146682704` (localizing slangc -reflection-json crash on failed compile, #11683). Re-triaged 2026-06-23 at HEAD a39e49c28 for a severity/scope question; two non-obvious findings the original note didn't capture:

**1. Scope is broad — not error-class- or target-specific.** SIGSEGV (exit 139) on EVERY error class probed (parse E20001, undefined-symbol E30015, type-mismatch E30019, undefined-call) and EVERY target (hlsl/glsl/metal/cuda/wgsl/spirv/spirv-asm/dxil), and on BOTH `-reflection-json file.json` and `-reflection-json -` (stdout). The trigger is exactly two conditions ANDed: (failed compile) AND (`-target` present). Dropping `-target` is the ONLY graceful path (clean E52009). Don't waste runs enumerating error kinds/targets — they all crash; the discriminator is the two conditions.

**2. NOT a release regression — longstanding.** The CLI reflection-emission block (`slang-end-to-end-request.cpp:1845`) was introduced 2025-07-24 (`8ccd495d5`, #7890) and NEVER had a compile-result gate. The no-target `if(!reflection)` guard (`c84bf11b1d`, 2025-11-10) only fixed the no-target subcase. Reporter's "2026.1 through 2026.11 all crash" is consistent — the feature predates 2026.1. So no priority elevation from "regression."

**3. Severity stance for a 'crash = P0?' question.** It is a real, trivially-triggered compiler segfault, BUT it fires only on an *already-failing* compile — the correct error diagnostic is emitted first, and valid `-reflection-json` output is never affected (verified: valid shader → exit 0, JSON fine). Honest verdict: P2 / severity medium, NOT SS/P0 (blocks no valid workflow; not a regression). The only lever toward P1 is a hard "compiler must never segfault" invariant plus reflection-json's use in automated pipelines — a maintainer judgment call, not a default. Reusable pattern: a crash that only manifests on input that was going to fail anyway is crash-hygiene, not a ship-stopper; resist the reflexive crash→P0 framing and quantify the blast radius.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782203064448-slang-11683-reflection-json-crash-is-broad-scope-a.md`_
