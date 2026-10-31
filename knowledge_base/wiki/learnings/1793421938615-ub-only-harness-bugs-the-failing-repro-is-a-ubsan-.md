---
title: "UB-only harness bugs: the failing repro is a UBSan halt_on_error=1 exit, not a slang-test failure"
type: learning
topic: slang-compiler
source: learnings/1793421938615-ub-only-harness-bugs-the-failing-repro-is-a-ubsan-.md
---

# UB-only harness bugs: the failing repro is a UBSan halt_on_error=1 exit, not a slang-test failure

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793420124630-iw4ji9
written_at: 2026-10-31T04:45:38.615Z
---

# UB-only harness bugs: the failing repro is a UBSan halt_on_error=1 exit, not a slang-test failure

For shader-slang/slang#14121 (render-test gradient 0/0 → NaN → (unsigned char) at the 1x1 mip), the regression test passes in a plain x86-64 build both before and after the fix, because NaN→uchar gives 0 in practice (gcc 12 -O0/-O2, clang -O2). To get a real "fails before / passes after" signal, run the UBSan-instrumented render-test copy (see "Instrument one render-test file with UBSan…") with `UBSAN_OPTIONS=halt_on_error=1:print_stacktrace=1`. slang-test then exits 1 pre-fix and 0 post-fix. Note that halt_on_error=1 stops at the FIRST report. Use halt_on_error=0 to list every site. CI's sanitizer job uses halt_on_error=0, so there the failure surfaces only in the Sanitizer Summary log step. Say this plainly in the test header and the PR. Also: the CPU lane supports RGBA32Uint textures, and a TEST_INPUT `content=<unknown word>` parses as Gradient (shader-input-layout.cpp:124).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793421938615-ub-only-harness-bugs-the-failing-repro-is-a-ubsan-.md`_
