# Slangi VM validator and executor must agree on operand-section size convention

# Slangi VM: validator and executor must agree on per-section operand-size convention

When a VM opcode validator special-cases an operand's `sectionId` to compute a different size (e.g. treats `kSlangByteCodeSectionStrings` operands as `sizeof(const char*)`), the runtime executor for the same opcode **must** mirror the convention. Otherwise validation passes but execution crashes — the failure looks like an impossible state.

## Concrete instance — Issue #11399 (printf with `%s` + string literal)

**Storage side** — `ByteCodeEmitter::addStringLiteral` (`source/slang/slang-emit-vm.cpp:113-128`) places literals in `kSlangByteCodeSectionStrings` and sets `operand.size = 0` (the actual `const char*` is stored elsewhere; the operand carries an index, not bytes). `addConstantValue(IRConstant*)` early-returns into this for `kIROp_StringLit`.

**Validator (correct)** — `slang-vm.cpp:988-995` (`VMOp::Print`) and `:941-955` (`VMOp::CallExt`):

```cpp
auto sectionId = getExecOperandSectionId(this, inst->getOperand(i));
auto size = sectionId == kSlangByteCodeSectionStrings
                ? sizeof(const char*)
                : inst->getOperand(i).size;
if (!check(i, size, OperandAccess::Read)) return false;
```

**Executor (asymmetric)** — `printHandler` in `slang-vm-inst-impl.cpp:1037-1043`:

```cpp
for (uint32_t i = 1; i < inst->operandCount; ++i) {
    auto& arg = inst->getOperand(i);
    List<uint8_t> data;
    data.setCount(arg.size);                              // 0 for Strings-section operands
    memcpy(data.getBuffer(), arg.getPtr(), arg.size);     // copy 0 bytes
    args.add(data);
}
// argPtrs[i] points to empty buffer; printf "%s" dereferences as const char* → segfault
```

Operand 0 (format string) **does** read `sizeof(const char*)` explicitly at line 1033, which is why `printf("hello")` works — the asymmetry only bites the variadic-arg loop.

## Pattern to apply for future VM intrinsics

When adding any byte-code VM opcode that takes operands which can come from special sections (Strings, Funcs, etc.):

1. Decide the section-aware size convention once.
2. Use it in **both** the validator (`slang-vm.cpp`) and the executor (`slang-vm-inst-impl.cpp`).
3. Prefer factoring `getExecOperandSectionId(...)` + the size lookup into a shared helper used by both sides; the bug class disappears at the type level.

## Detection signal in symptoms

If a slangi crash report says "validation passed but `printHandler` / executor segfaulted" and the operand involved came from a string literal or any non-Constants section, suspect this asymmetry first. Compare the validator's per-section size logic to the executor's per-operand `arg.size` reads — any divergence is the bug.
