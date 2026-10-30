---
type: chain
title: slang#14061 — SPIR-V double log/exp/pow/sin emit GLSL.std.450 ops that allow only 16/32-bit floats (invalid module, no diagnostic)
description: Human-filed (albertrodriguezclo) bug 2026-10-29 22:05:28Z. Triaged bug/medium/P2 by slang-triager 22:19Z (core-module intrinsics own the fix). Parked under R6 (no bot comment before 2026-11-02T22:05:28Z); re-check t-e9b64f 11-02 22:30Z.
tags: [spirv, emit, fp64, glsl-std-450, capabilities, r6]
---

# slang#14061 — double transcendentals → invalid GLSL.std.450 on SPIR-V

**Ask.** On `-target spirv`, `log`/`exp`/`pow`/`sin` on `double` emit `OpExtInst %double ... Log/Exp/Pow/Sin`.
GLSL.std.450 defines these for 16/32-bit floats only, so spirv-val rejects the module; slangc gives no diagnostic.
`sqrt` on `double` is valid (`Sqrt` allows 64-bit). The reporter wants a compile-time error (the `[require]` on the
`log` overload admits SPIR-V for any `__BuiltinFloatingPointType`) or a valid Vulkan lowering (a double implementation in Slang).
Reported on master 9931ba0ea, Windows.

**Routing (10-29 ~22:07Z).** Live check: open, 0 comments, no labels, no Type, no triager session; memory grep
for 14061 had no chain hit. Main session `sess-1793311530802-rfe1x8`. Dispatched to slang-triager on
`gh-issue-shader-slang/slang-14061` with the **R6 hold**: the fenced blocks hold a validator error, not a crash word,
and there is no `bot-ok`, so no bot comment before **2026-11-02T22:05:28Z**. The memo returns to Main only. The triager
sets one one-shot after the hold, which first checks for a reporter PR or maintainer comment (this reporter often opens
their own fix PRs — see [14059](14059-ternary-ptr-nullptr-overload.md)). Sibling double-precision ask: [14057](14057-unsuffixed-float-literal-double-warning.md).

**Triage (slang-triager, 10-29 22:19Z, ToT 977df1246). These are the triager's findings; I did not reproduce them.**
bug / medium / target-emit (SPIR-V) + core module / P2. Not a dup and not a regression: docs/64bit-type-support.md:96-108
has listed it as a limitation since 2025. Related: #4947 (capability check for unsupported numeric types) and #14062 (same reporter).
- ~22 functions emit invalid code on double. They include the trig and hyperbolic functions, exp/exp10/log/log2/log10/pow,
  radians/degrees and sincos, plus vector exp2/ldexp.
- Scalar exp2/ldexp are silently narrowed to float (hlsl.meta.slang:11362).
- GLSL is rejected by glslang, DXC narrows silently, Metal/WGSL give an internal "'double' type emitted" error, and CUDA is correct.
- With validation off on the L40S, the Vulkan run dumps core.
- Layer: the core-module intrinsics. The `spirv_asm OpExtInst $$T glsl450 Log` at hlsl.meta.slang:13325/13345 copies T through.
  `[require]` cannot fix it, because capabilities are computed once per generic declaration (slang-check-decl.cpp:22269).
- **Recommended A:** `static_assert(!__isDouble<T>())` in the spirv/glsl cases, after the `__isHalf` precedent at hlsl.meta.slang:2347,
  which is checked after specialization at slang-emit.cpp:695. The triager prototyped it in user code.
  The alternatives are B (fp64 implementations written in Slang, a maintainer-level feature), C (narrow to float) and D (an emit-side opcode table).

**Parked 10-29 22:19Z.** The triager did not hand off to slang-fixer: A vs B is a maintainer decision, and the reporter may open their own PR.
Nothing is on GitHub (R6). The one-shot **t-e9b64f** runs 2026-11-02 22:30Z. It checks for a reporter PR or maintainer comment first,
then posts the 5-bullet and sets Type=Bug and `reproduced`. Owner: slang-triager on `gh-issue-shader-slang/slang-14061`.
Memo: `/workspace/inbox/a2a-1793312349505-0psyre/triage-14061.md` (triager copy: `memory/issues/triage-14061.md`).
