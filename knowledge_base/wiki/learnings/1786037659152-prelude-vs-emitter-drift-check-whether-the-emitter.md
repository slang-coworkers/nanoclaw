---
title: "Prelude-vs-emitter drift: check whether the emitter already made the decision (slang#12401)"
type: learning
topic: slang-compiler
source: learnings/1786037659152-prelude-vs-emitter-drift-check-whether-the-emitter.md
---

# Prelude-vs-emitter drift: check whether the emitter already made the decision (slang#12401)

When triaging a "the prelude does X inefficiently" issue for a C-family target, **check whether the
emitter already does the better thing** — the strongest argument is often that the decision was made
years ago and the hand-written prelude was never brought along.

**slang#12401** (CUDA vector operator macros use `for(i)` + `_slang_vector_get_element_ptr`):
`source/slang/slang-emit-cpp.cpp:1567-1575` / `:1608-1618` already emit `.x/.y/.z/.w` for a
**literal** index and reserve the accessors for **dynamic** ones. That branch came from
**PR #2770, squash `b68516e2c2e3`, 2023-04-03**, which touched `prelude/` **zero times**. So the
prelude was a 3-year-old leftover, not a new optimization idea — and that reframing is what justifies
a prelude-only, non-breaking scope with no IR pass.
Cheap check: `git grep -l <MACRO_NAME> -- .` (1 file = prelude only ⇒ no consumer depends on it) and
`git show --name-only <sha> | grep -c '^prelude/'`.

**nvcc IS available for GPU-free prelude work** (`/usr/local/cuda-12.6/bin/nvcc`, 12.6.85, + nvrtc).
Patch a copy of the prelude, compile a TU both ways, diff PTX. No GPU needed — prelude compile/codegen
questions are all front-end.

**Three traps this cost me:**
1. ⛔**"Byte-identical PTX" from a narrow TU is a claim about my TU, not the change.** My small probe
   showed identical opcode census; a WIDE sweep (33 kernels = all 9 integer + 2 float families ×
   widths 2/3/4 × arith/bitwise/shift/logical/compare/unary, **runtime** operands so nothing folds)
   showed 9099→9097 insts with **7 of 33 kernels differing**. An adversarial reviewer predicted
   exactly this ("your census could be an artifact of the TU not exercising some instantiation").
   ⇒ enumerate the instantiation matrix from the macro's own type list, don't hand-pick ops.
2. ⭐**Opcode difference ≠ semantic difference — measure VALUES.** The one outlier (+4 insts on the
   float `&&`/`||` path, `selp.f32`→`selp.u32`+`cvt.rn.f32.u32`) looked alarming. Feeding
   compile-time-constant inputs makes nvcc fold results into `mov.u32` immediates that are then
   stored, so **the PTX literally contains the computed values**: extract the bit patterns from both
   files and compare. All 24 identical ⇒ codegen strategy, not semantics.
3. ⚠**Timing runs must be order-balanced.** Mine ran base-then-patched every rep, so warmup was
   confounded with the change. Direction was still safe (ranges non-overlapping) but a magnitude
   would not have been ⇒ publish direction only, and say so.

**Argument worth reusing:** the accessor form is not merely slower, it is **less well-defined** —
`SLANG_VECTOR_GET_ELEMENT_PTR(char)` casts to `char*` while CUDA's `char2/3/4` members are
`signed char` (`vector_types.h:115`); on Linux `typedef int64_t longlong` makes it `long` while
`longlong2` members are `long long`; `bool3` is `__align__(1)` with three separate `bool` members the
accessor treats as an array. So don't claim the two forms are *formally equivalent* — claim the direct
form is better defined and measurably same-valued.

**Instrument bugs hit:** `gh issue view … | head` returned 0 bytes while file redirection returned
8318 (use `> file` then Read); `bc` is absent so every `$(echo "$e-$s"|bc)` timing read `0.000` — a
**void matrix**, not a null result (use Python `perf_counter`); `g++` refuses a `.cu` extension; a
device-only prelude cannot be host-compiled at all (use `nvcc -ptx` + a kernel);
`pkill -f 'nvcc.*med-'` killed my own shell.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786037659152-prelude-vs-emitter-drift-check-whether-the-emitter.md`_
