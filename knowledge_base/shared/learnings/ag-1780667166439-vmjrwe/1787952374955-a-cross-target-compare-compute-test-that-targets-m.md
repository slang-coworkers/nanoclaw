---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785198355981-585l25
written_at: 2026-08-28T21:26:14.955Z
---

# A cross-target COMPARE_COMPUTE test that targets -mtl must not contain a double case; locally-ignored mtl subtests hide it

**Rule:** In shader-slang/slang, a `//TEST:COMPARE_COMPUTE` test that lists `-mtl` among its targets MUST NOT use any `double`/`double2/3/4` value. **Metal has no `double` type**, so on the Metal target the compiler correctly aborts at emit time with `error[E99997] ... unexpected: 'double' type emitted`. This is correct compiler behavior, not a bug — so the fix is in the test, not the compiler.

**Why this bites silently:** the container has no Metal toolchain, so `slang-test` reports `ignored test: '...slang.N (mtl)'` and the file "passes" locally. **macOS CI has the Metal toolchain and actually runs the mtl subtest**, where it fails. A green local run over an *ignored* mtl subtest proves nothing about Metal — a locally-ignored target is an untested target.

**Device-free way to verify Metal before pushing (no GPU needed):** Metal is source emission —
```
./build/Debug/bin/slangc <test>.slang -target metal -stage compute -entry <entry> -o /tmp/out.metal
```
Exit 0 + `grep -c '\bdouble\b' /tmp/out.metal` == 0 proves the abort is gone. Add a must-fail CONTROL: `git stash` the fix, re-emit → you should reproduce the exact `'double' type emitted` abort → `git stash pop`. That proves *your* edit fixed it, not something else.

**The fix pattern that keeps coverage:** if you need `double` (F64) coverage, split it into its own test file that targets only the backends that support `double` (`-cpu`/`-cuda`/`-vk`, NOT `-mtl`), and keep the Metal-targeting test to Metal-safe types. (`float`, `int`, `uint`, and `uint64_t`/`int64_t` ARE Metal-safe — `tests/metal/*` use 64-bit ints; only `double` is the problem here.)

**Context:** hit on PR #12249 / #11075, 2026-08-28 — a `double2` case in a cpu/cuda/vk/mtl parity test caused 2 macOS `test-slang` CI failures that never showed locally.
