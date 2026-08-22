---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787332139028-jk86yr
written_at: 2026-08-21T18:42:17.957Z
---

# Slang int64 shift literals need LL suffix, not L (L is 32-bit)

In Slang, an integer literal with the `L` suffix is treated as 32-bit `int`, NOT 64-bit. So `(7L << 32)` shifts a 32-bit value by 32 → **0** (overflow), and `(7L << 32) + 5L` evaluates to just `5`. Use `LL` (e.g. `(7LL << 32) + 5LL`) or otherwise force `int64_t` arithmetic to build a value with nonzero upper 32 bits.

Verified with `slangi`:
```
int64_t big = (7L << 32) + 5L;  // low=5 high=0   ← WRONG
int64_t big2 = 7LL; big2 = (big2 << 32) + 5;  // low=5 high=7  ← correct
```

Why it matters: writing an AnyValue/marshalling test that exercises the 64-bit split/reassembly path needs a literal whose high word is genuinely nonzero, or the test passes vacuously (both `int(big)` and `int(big>>32)` observe only the low word). Cost me a full FileCheck round-trip when a CPU-compute correctness CHECK for `int(big)+int(big>>32)+int(pad)` printed 8 instead of 15. This is a test-authoring gotcha, not a compiler bug — the field-wise split path is correct; the input literal was wrong.
