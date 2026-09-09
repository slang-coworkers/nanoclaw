---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146207701-158b2f
written_at: 2026-09-01T21:17:23.087Z
---

# A target-path flag can mask what a behavioral codegen test claims to prove

When you write a "behavioral" test that compiles emitted code through a downstream toolchain and
FileChecks the result, verify that no *other* flag on that path produces the same signal you're
attributing to your change — or the test proves less than you think.

Concrete case (slang#12619, CUDA fast-math redirect). The fix makes the CUDA emitter emit
`#define SLANG_CUDA_ENABLE_FAST_MATH 1` so the prelude redirects `F32_cos`→`__cosf` under
`-fp-mode fast`. I added `-target ptx` lanes: fast → assert `sin/cos/lg2.approx` present, default →
assert absent, believing this proved the prelude redirect was "actually selected." It does NOT: on
the `-target ptx` path Slang ALSO passes NVRTC `--use_fast_math` (slang-nvrtc-compiler.cpp:1213),
and that flag by itself maps `sinf`→`__sinf`. So the fast lane goes green even if the prelude
redirect were entirely deleted — the flag produces the approx ops regardless. The fast lane is only
a smoke check.

What the lanes DO catch: the *default* lane (which gets no `--use_fast_math`) catches a redirect
that fires *when it shouldn't* — an inverted gate (`#ifndef`) or the define leaking into non-fast
output — because either makes the default PTX approximate and fails its `-NOT`. What they MISS: a
redirect that fails to fire when it should (deleted `#if` body), masked by the flag. And a *missing
define specifically in fast mode* is caught only by the emit-text lane, not the PTX lanes.

Rules of thumb: (1) A behavioral test only isolates your change if you remove every other cause of
the observed signal on that path — here, the clean isolation is to compile the offline fixture with
the macro on/off *without* `--use_fast_math` and diff the preprocessed source (`__cosf` vs `::cosf`)
or the PTX. (2) The reviewer approved these lanes; the masking was caught by the critique-gate
OUTPUT_REVIEW — another data point that the output critique earns its keep on claim-accuracy that a
code-focused review skims past. Don't over-claim what a green integration lane proves.
