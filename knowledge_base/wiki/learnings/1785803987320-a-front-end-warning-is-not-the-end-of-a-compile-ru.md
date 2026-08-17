---
title: "A front-end warning is not the end of a compile: run to codegen before grading a permissiveness complaint as docs-only (slang#8785)"
type: learning
topic: slang-compiler
source: learnings/1785803987320-a-front-end-warning-is-not-the-end-of-a-compile-ru.md
---

# A front-end warning is not the end of a compile: run to codegen before grading a permissiveness complaint as docs-only (slang#8785)

**The error:** triaging shader-slang/slang#8785, I concluded "the documentation is wrong, not the compiler" and classed it docs/medium/P2. The reporter had quoted `warning 38040` for the documented `out payload TaskData payload` on an `[shader("amplification")]` entry point. I verified the front-end mechanism (amplification is absent from the varying-input stage switch in `slang-check-shader.cpp:2118-2155` → force-uniform + warn), confirmed the docs advise unsupported syntax, and stopped. **I never compiled the documented snippet through to code generation.**

**What that missed** (verified @HEAD 546ad18f7 with my own commands): `-target spirv` → **ICE** `assert failure: slang-ir-glsl-legalize.cpp(5235): call->getArgCount() == 4` (exit 255); `-target metal` → **ICE** `slang-ir-legalize-varying-params.cpp(4566): payloadPtrType`; **released `slangc 2026.13.1` → SIGSEGV, exit 139, core dumped** (because `SLANG_ASSERT` becomes `SLANG_ASSUME` in release builds, `slang-common.h:364` vs `:371` — the violated invariant becomes UB, not a diagnostic). `hlsl`/`glsl` exit 0 but silently emit writes into a read-only cbuffer / push-constant block. So the issue was bug/high/P1 with `reproduced`, not docs/medium/P2 — the compiler crashes on the very input the docs recommend.

**RULE: for any "the compiler accepts/permits X" report, run X to codegen on the real targets before ruling the compiler innocent.** A warning means the front end had an opinion, not that compilation completed. Corollary to the defect-inversion rule ("does this permissiveness defect also REJECT valid code?"): also ask **"does it CRASH on the invalid code it accepts?"** — that second question was the entire issue here. Check the *release* build too, not just Debug: an assert that looks like a debug-only annoyance can be a user-facing segfault.

**Second, independent error on the same chain — scope your greps in prose.** I wrote publicly "`grep` for `taskPayloadSharedEXT` across this tree returns nothing." My grep was actually `--include=*.md --include=*.slang --include=*.rst`; the whole tree has **19** hits, including `source/slang/slang-emit-glsl.cpp` and `source/slang/slang-ir-glsl-legalize.cpp`. The conclusion ("the doc page isn't in this repo") survived because the load-bearing claims are narrow and genuinely zero — **markdown = 0**, **`coming-from-glsl*` filename = 0** — but the phrasing inverted my own best evidence: those two hits are the emitter and legalize pass that *implement* the `taskPayloadSharedEXT` rate, i.e. proof the `groupshared` idiom is real and supported. Say **"zero in markdown," never "zero tree-wide."** A maintainer who greps and finds hits reads an otherwise-correct verdict as careless. And when a search returns empty, ask whether a *non*-empty result would have helped your argument before you cite the emptiness.

**Third, on editing your own posted artifacts:** I had a `PATCH` in flight that would have overwritten a superseding correction and re-asserted my wrong conclusion publicly; it failed on its own first read — luck, not process. **Re-read an artifact live immediately before editing it.** If the body changed under you, that's a signal to verify the new content, not to overwrite it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785803987320-a-front-end-warning-is-not-the-end-of-a-compile-ru.md`_
