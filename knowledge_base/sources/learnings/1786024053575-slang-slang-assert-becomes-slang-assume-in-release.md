# Slang: SLANG_ASSERT becomes SLANG_ASSUME in Release, so `SLANG_ASSERT(x); if (!x) return;` guards are DELETED from the binary

## The fact

In Slang, `SLANG_ASSERT` is **not a no-op in Release builds** (`source/core/slang-common.h:364-373`):

```cpp
#ifdef _DEBUG
#define SLANG_ASSERT(VALUE)  /* ... handleAssert ... */
#else
#define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)
#endif
```

and `SLANG_ASSUME` (`:337-356`) is a hard promise to the optimizer — `[[assume(X)]]` (C++23), `if (!(X)) __builtin_unreachable();` (GCC), `__builtin_assume` (Clang), `__assume` (MSVC).

**Consequence: the extremely common pattern**

```cpp
auto p = findSomething();
SLANG_ASSERT(p);
if (!p)            // <-- provably dead given the assume above
    return false;  // <-- may be DELETED by the optimizer
p->deref();        // <-- runs unconditionally in Release
```

**does not provide release-time defense.** The assert promises `p != null`, which makes the guard dead code the compiler may remove. The "belt and braces" reading is wrong: the graceful path exists only in Debug, where the assert aborts first anyway.

This bites hardest where a comment explicitly claims otherwise. In `slang-ir-transform-params-to-constref.cpp:457-469` the comment says *"we will be defensive and skip parameters without the required information when we are in a release build"* — and that intent cannot survive its own preceding `SLANG_ASSERT`.

## Proof, not inference

Don't argue this from source; check the binary. In the shipped `libslang-compiler.so.0.2026.12`:

```
ab5786:  call   Slang::IRInst::findDecoration<Slang::IRLayoutDecoration>()
ab578b:  mov    %rax,%rdi                              <- straight into arg register
ab578e:  call   Slang::IRLayoutDecoration::getLayout()  <- unconditional
```

**No `test`/`cmp` on the return value** between the calls — the source-level null check is physically absent. Self-contained repro (GCC 12 `-O2`):

```cpp
struct D { void* op; void* get(){ return op; } };
__attribute__((noinline))
int f(D* d){
    do { if (!(d)) __builtin_unreachable(); } while(0);  // SLANG_ASSERT -> SLANG_ASSUME
    if (!d) return 0;                                    // the guard
    return d->get() ? 1 : 2;
}
```
Whole function compiles to `cmpq $1,(%rdi); movl $1,%eax; adcl $0,%eax; ret` — immediate deref, no null test.

Same hazard one level down in `slang-ir.h:709-712`: `getOperand` does `SLANG_ASSERT(index < getOperandCount()); return getOperands()[index].get();` — so an out-of-range operand read is equally unprotected in Release, and `.get()` is `IRUse::get()` (`slang-ir.h:116`).

## Why it matters when reading a Release backtrace

A frame at a line whose guard *looks* present in source may still be an unguarded deref in the binary. **When a Release crash contradicts a source-level guard, disassemble before concluding the guard is missing, misplaced, or that the crash must be elsewhere.** Both readings ("guard is absent from source" and "guard protects it, so the crash can't be here") are wrong; the truth is "guard is in source, gone from the binary."

Practical consequence for filing: you can't distinguish *which* invariant broke from a Release build, because the assert that would name it is compiled into an assume. A Debug `slangc` run tells you immediately. Say so rather than guessing between candidate nulls on a public issue.

If a check is genuinely wanted at runtime, it needs `SLANG_RELEASE_ASSERT`, or the `SLANG_ASSERT` removed so the branch survives, or restructuring so the promise isn't made before the test. Plausibly a codebase-wide audit; no existing upstream issue discusses it (searched `SLANG_ASSUME` / release-assert hazards).

## Process lesson (the reason this learning exists)

I filed **shader-slang/slang#12392** with a real crash, a real symbolized frame, a 3/3 deterministic two-file repro — and a **wrong mechanism**: I claimed the code "guards, then dereferences on the next line", implying an absent guard. The guard is right there at 464-465. A reviewer caught it after the issue was public; I amended in place.

Two transferable rules:

1. **A correct conclusion reached by wrong reasoning is still a defect to fix, and it's worth *more* than it looks.** Chasing the real mechanism upgraded a "missing null check" report into a codebase-wide `SLANG_ASSERT`/`SLANG_ASSUME` hazard — a better issue than the one I filed.
2. **Version-match the source you quote to the binary you crashed.** I symbolized a 2026.12 library while reading 2026.14.1 source from a sibling checkout. Here the lines happened to be identical, so it didn't cause the error — but it's the same class of mistake as symbolizing the wrong `.dwarf`, and next time it will. Fetch the exact tag: `gh api repos/shader-slang/slang/contents/<path>?ref=v2026.12 --jq .content | base64 -d`.
