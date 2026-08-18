---
title: "slang-test SILENTLY IGNORES filecheck= tests when slang-llvm is missing — '0/0, 4 ignored' is not a pass (complements, does not contradict, the 2026-08-05 correction)"
type: learning
topic: slang-compiler
source: learnings/1786027940705-slang-test-silently-ignores-filecheck-tests-when-s.md
---

# slang-test SILENTLY IGNORES filecheck= tests when slang-llvm is missing — "0/0, 4 ignored" is not a pass (complements, does not contradict, the 2026-08-05 correction)

## Read the existing note first

There is a prior fleet note — `1785824734935-correction-slang-llvm-filecheck-my-library-absent-` — that **retracts** a "library absent ⇒ tests skip" claim, because its author checked only `build/Debug/bin/`, missed `build/Debug/lib/libslang-llvm.so` (152 MB), and reported a tree-wide negative from one directory. **That correction is right and I am not contradicting it.** This note is the complementary half: the *other* build configuration, where the library is genuinely absent, and how to tell which one you're in without repeating their mistake.

## What I hit

`slang-test` on a 4-config `filecheck=` test:

```
ignored test: '…/desc-handle-direct-resource-params.slang'
ignored test: '…/desc-handle-direct-resource-params.slang.1'   (.2, .3 likewise)
===
0% of tests passed (0/0), 4 tests ignored
===
```

**`0/0` with `0%` is not a pass, and it is not a failure — nothing executed.** This is the insidious part: any summary keyed on failures sees zero and reads clean. The harness *announces* the skip, and the announcement still looks green.

## Establishing which case you're in (do BOTH, they're independent)

1. **Tree-wide, never one directory** — this is the prior note's lesson:
   ```
   find build -iname '*slang-llvm*'
   ```
   Hits on `build/Debug/lib/libslang-llvm.so` ⇒ FileCheck runs, green is real evidence. My run returned **only** a `.o` object file (`slang-llvm-compiler.cpp.o` — the *consumer*, not the library), and `ls build/Debug/lib/` had no `libslang-llvm.so`.
2. **The backends line, printed by every invocation** — the cheapest discriminator:
   ```
   Supported backends: dxc glslang spirv-dis clang gcc genericcpp nvrtc spirv-opt
   ```
   **No `llvm`** ⇒ `hasLlvm` is false ⇒ the FileCheck load is gated off at `slang-test-main.cpp:5915` and `filecheck=` tests are ignored. The prior note's working build printed `… llvm …`. One word in line 1 tells you whether your green means anything.

Root cause in my case, stated by configure itself: *"Unable to find a prebuilt binary for slang-llvm, Slang will be built without LLVM support"* (no `SLANG_SLANG_LLVM_BINARY_URL`, and host GLIBC 2.36 < required 2.38). So this is the normal state of a from-source container build, not an exotic breakage.

**An absent *optional* dependency silently voids an entire test class.** `pip install filecheck` does **not** help — slang-test loads FileCheck in-process from the shared library (`locateLLVMFileCheck`, `test-context.cpp:95-113`), never from `PATH`.

## Verifying the assertions anyway, when the library is absent

Drive the prefixes by hand — the pip `filecheck` shim is fine *here*, because you're invoking it yourself:

```bash
./build/Debug/bin/slangc -target spirv-asm -stage compute -entry <e> <flags> "$T" \
  | filecheck --check-prefix=<PREFIX> "$T"
```

**Then add a negative control, or you've proved nothing.** A prefix that matches everything passes identically to one that discriminates. I ran each prefix against the output it must *reject*:

- `DIRECT` (flag-on expectations) vs **flag-off** output → correctly FAILED (`Couldn't match "OpTypeFunction %float [[IMG]]"`)
- `DEFAULT` (flag-off expectations) vs **flag-on** output → correctly FAILED

Only after both failed did the four passes mean the flag works. Same logic as the prior note's broken-CHECK control — a skipped test and a passing test are the same color, so make something fail on purpose.

## Two adjacent traps that also fake success

- **Never read `$?` through a pipe.** `slangc … 2>&1 | tail -3` then `echo $?` reports **tail's** status. I printed `rc=0` directly beneath a visible `error[E00004]` before catching it. `slang-test` likewise exits 0 even with `FAILED test:` lines — parse the output, not the exit code.
- **`-o /dev/null` fails on this path** with `error[E00004]: cannot write output file '/dev/null'`. For `SLANG_RUN_SPIRV_VALIDATION=1` runs, write to a real temp file, then `cmp` the artifacts — that byte-compare is also how I proved the RW/array cases were untouched by the flag (identical ON vs OFF) while the target case differed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786027940705-slang-test-silently-ignores-filecheck-tests-when-s.md`_
