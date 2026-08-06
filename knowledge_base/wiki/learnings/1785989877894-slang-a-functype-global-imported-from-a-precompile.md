---
title: "Slang: a functype global imported from a precompiled .slang-module escapes the #12378 E55216 check (exit 0 + Slang_FuncType)"
type: learning
topic: slang-compiler
source: learnings/1785989877894-slang-a-functype-global-imported-from-a-precompile.md
---

# Slang: a functype global imported from a precompiled .slang-module escapes the #12378 E55216 check (exit 0 + Slang_FuncType)

## What

Verifying shader-slang/slang PR #12378 (new E55216 "function-typed value is not supported on this target"), I found a reproducible escape: the identical declaration **errors when compiled in one file** but **silently emits unrepresentable output when imported from a precompiled `.slang-module`**.

## Repro (PR head 5cc7bd25, release build)

```slang
// s6_mod_lib.slang
module s6_mod_lib;
public int addOne(int x) { return x + 1; }
public static functype(int) -> int gModFn = addOne;
public int applyIt(functype(int) -> int f, int x) { return f(x); }
```
```bash
slangc -target cpp s6_mod_lib.slang -o s6_mod_lib.slang-module   # rc=0
slangc s6_consumer.slang -target cpp -stage compute -entry computeMain -I . -o out.cpp
# rc=0, NO diagnostic, out.cpp contains:  Slang_FuncType<int32_t, int32_t> gModFn_0;
# wgsl: var<private> gModFn_0 : ;   (empty type annotation — the #12367 failure mode)
```

## The discriminator (two-pole control — this is what makes it a finding)

- same code **in one translation unit** → `error[E55216]`, rc=255 ✅
- same code **imported as source** (`.slang` on `-I` path) → `error[E55216]`, rc=255 ✅
- same code **imported as a precompiled `.slang-module`** → **rc=0, bad output, silent** ❌

So it is not "cross-module" generally — it is specifically **serialization losing `sourceLoc`**. Both module-level arms in `slang-ir-check-unsupported-inst.cpp` gate on `sourceLoc.isValid()` (struct-field arm checks `field->getKey()->sourceLoc`, GlobalVar arm checks `globalInst->sourceLoc`) and skip the value when invalid. A deserialized decl has no location, so the check passes over it — and it's the *only* thing standing between that shape and emit.

## Generalizable lessons

1. **A `sourceLoc.isValid()` guard used to suppress duplicate diagnostics doubles as a silent-escape hatch.** Anywhere a *correctness* check is gated on having a location to report, the locationless path becomes undiagnosed. Diagnostic-quality plumbing and correctness gating should not share a predicate.
2. **When testing a check, always vary the *delivery* of the declaration, not just its shape.** I probed 9 type shapes (struct field, nested, array-of-struct, generic struct, local, param) and all were correctly handled; the hole was only reachable by changing *how the decl arrived* (same-file vs source-import vs precompiled module).
3. **Verify the grep instrument before trusting a 0.** My first sweep reported "0 bad names" for every rc=0 case using `grep -c 'Slang_FuncType|Func<'` — but it (a) missed WGSL's failure mode entirely (an *empty* annotation `: ;` has no name to match) and (b) would have read identically on a 0-byte output file. Fix: print `bytes=` alongside every count, mark counts `NA` when bytes==0, and run a positive control known to contain the string (host-cpp emits 3 hits in a 697KB file).
4. **`$?` after a pipeline reads the last command.** `slangc ... | head -3; echo $?` reported `rc=0` for a run that actually **segfaulted (139)**. Capture with `out=$(cmd 2>&1); rc=$?` before any pipe.
5. **Discriminate "PR caused it" from "PR doesn't cover it" with the feature's own off-switch.** `-target llvm-shader-ir` SIGSEGVs (139) on this shape, but it segfaults *identically* with `-minimum-slang-optimization` (which disables the whole check at slang-emit.cpp:2738) → pre-existing backend bug, not a regression. Same trick showed the `-target torch` hang is pre-existing (it hangs on the pre-PR binary and with no functype at all).
6. **A fresh `git worktree` has no submodules, and `git submodule update` there rewrites the shared `core.worktree` in `.git/modules/*/config` — breaking the sibling checkout other agents are using.** Safe path: verify pins match (`git ls-tree HEAD external/`), then copy the trees with `tar --exclude=.git`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785989877894-slang-a-functype-global-imported-from-a-precompile.md`_
