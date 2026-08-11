---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378646047-ciy8m8
written_at: 2026-08-10T18:06:49.770Z
---

# A reviewer's plausible mechanism can be dead by the time it reaches your layer — check the FINAL IR, not the lowered IR

## The trap

Reviewing a fix that added `basicType = as<IRType>(unwrapAttributedType(basicType))` to the SPIR-V
arithmetic classifier (`_arithmeticOpCodeConvert`, `slang-emit-spirv.cpp:815`), codex raised a
SHOULD-FIX that was **mechanically well-argued and still wrong**:

> `no_diff int` lowers to `Attributed(Int, NoDiff)`, so the unwrap makes `isSignedType()` switch
> division/remainder/comparison from unsigned to signed opcodes — correct but broader than the
> float regression; add signed-integer coverage.

Every premise checks out in isolation:
- `Attributed(Int, %1)` **really is** produced — visible in the `### LOWER-TO-IR:` dump as
  `func %divide : Func(Int, Attributed(Int, %1), Attributed(Int, %1))`.
- `isSignedType` (`slang-ir-util.cpp`) **really does not** look through `IRAttributedType` — its
  switch handles `kIROp_IntType`, `kIROp_VectorType`, `kIROp_MatrixType`, then `default: return false`.

So "attributed signed int → classified unsigned → my unwrap flips it to signed → opcodes change for
existing shaders" is a coherent story. It is also false.

## What settled it

Measured on the **pre-fix** binary, with runtime operands (constant folding hides this — my first
probe used literals `f(-7, 2)` and emitted no div opcode at all):

```
%63 = OpSDiv %int %x %y
%66 = OpSRem %int %x %y
%70 = OpSLessThan %bool %x %y
```

Already signed **before** the fix ⇒ the unwrap cannot be what flips them.

The mechanism, from the IR dump captured off **stderr** (`-dump-ir` writes there; redirecting only
stdout silently yields nothing):
- In `### LOWER-TO-IR:` the *parameters* are `Attributed(Int, %1)` — but the arithmetic instruction's
  own result is already plain: `let %4 : Int = div(%a, %b)`.
- In the last section (`### AFTER checkUnsupportedInst:`) `grep -c 'Attributed(Int'` = **0** while the
  three arithmetic insts are still present.

The attribute is stripped from int params by emit time. The classifier never sees it.

## Rules

1. **An attributed/wrapped type existing in the IR does not mean it exists at YOUR pass.** Count it in
   the *final* dump section, not the first. `Attributed(...)` at `LOWER-TO-IR` and `Attributed(...)`
   at emit are different claims; 145 hits across the whole dump was 0 hits where it mattered.
2. **Constant folding is a plausible-negative for opcode probes.** Literal operands make the
   instruction disappear, which reads identically to "the opcode is fine." Force runtime values
   (load from a buffer) before concluding anything about which opcode is selected.
3. **`-dump-ir` goes to stderr.** `slangc ... -dump-ir > f.txt` captures nothing; you need `2>`.
   My first attempt reported `0 Attributed` purely from this.
4. **A refuted review finding still needs a positive control.** I only trusted the refutation once
   the pre-fix binary showed the signed opcodes — i.e. I demonstrated what the *unfixed* compiler does,
   not merely that the fixed one looks fine.

## Also worth keeping (same review)

`expected-failures.txt`'s lint (`docs/generated/tests/_meta/regenerate.py:731`, `lint_expected_failures`)
treats a **blank line as ending the tracking-link group**. So deleting a suppression block can silently
re-parent the entries below it onto your comment's issue link. A "cosmetic" blank line there is
load-bearing — run the lint (and run it on unmodified master as a control) after editing that file.
