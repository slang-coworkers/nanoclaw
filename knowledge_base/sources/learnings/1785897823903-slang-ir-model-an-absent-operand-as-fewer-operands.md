# Slang IR: model an absent operand as FEWER operands, never a null operand (IRDebugInlinedAt precedent)

## Rule

When an IR instruction has an optional trailing operand, build it with **fewer operands** and make the
accessor **operand-count-aware**. Never construct a fixed-arity inst with a `nullptr` operand.

## Why — a null operand SIGSEGVs the call-graph walk

`source/slang/slang-ir-call-graph.cpp:85-88` (verified at master `ca76f8781a`):

```cpp
for (UInt i = 0; i < inst->getOperandCount(); i++)
{
    auto operand = inst->getOperand(i);
    switch (operand->getOp())   // <-- no null check
```

`buildEntryPointReferenceGraph` dereferences every operand unguarded, and it runs before SPIR-V emit
(inside `processLateRequireCapabilityInsts`, after `eliminateDeadCode`). A null operand crashes there,
far from wherever it was constructed.

## The in-tree precedent — `IRDebugInlinedAt`, all four legs verified

- **Declares 5:** `source/slang/slang-ir-insts.lua:2986` → `{ DebugInlinedAt = { min_operands = 5 } }`
- **Builds 4 *or* 5:** `source/slang/slang-ir.cpp:3635-3653` branches explicitly —
  `if (outerInlinedAt)` → `emitIntrinsicInst(..., 5, args)`; `else` → `emitIntrinsicInst(..., 4, args)`
- **Accessor gates on the count:** `source/slang/slang-ir-insts.h:2776-2778` →
  `IRInst* getOuterInlinedAt() { if (operandCount == 5) ... }`
- **`min_operands` is NOT enforced.** It flows into `IROpInfo::fixedArgCount` and no validator compares
  it against an inst's actual operand count. So declaring 5 while building 4 is legal *and shipped*.

⭐ **"A shipped precedent" is a stronger argument than "no validator checks it."** An absence of
enforcement can be closed by someone adding a validator later; an existing convention that already
passed review cannot be retroactively made illegal without breaking that code too.

## The trap this protects against — an accessor that reads out of bounds in RELEASE only

`IRDebugNoScope::getScope()` (`slang-ir-insts.h:2799`) is a bare `return getOperand(0);` while
`emitDebugNoScope()` (`slang-ir.cpp:3686-3688`) constructs with `0, nullptr` and
`slang-ir-inline.cpp:369` calls it bare. `getOperand` is:

```cpp
IRInst* getOperand(UInt index)
{
    SLANG_ASSERT(index < getOperandCount());
    return getOperands()[index].get();
}
```

`SLANG_ASSERT` **compiles out in release**. So on a 0-operand instance: debug trips the assert, release
reads past the operand array and returns garbage. **It will not reproduce in debug testing.**

Remedy: gate the accessor on `getOperandCount() >= 1` (same idiom as `getOuterInlinedAt()`), or convert
every producer and assert the invariant at construction — the latter only if you enumerated producers
**from the builder method** (`emitDebugNoScope`, declared `slang-ir-insts.h:3684`), not from
classification `switch` labels.

## ⚠️ The audit shape that fails here

"No consumer reads this inst's operands" derived from grouped `case` labels in classification switches
is true of *current* consumers — and is exactly what adding an operand falsifies, because the new
accessor **is** such a read. Verifying one consumer (or one kind of consumer) and claiming all of them
is the recurring error. Enumerate from the producer/builder side.
