# slangi VM emitter constant section: write sizeAlignment.size bytes, not natural type size

# slangi VM emitter — constant section pattern

In `source/slang/slang-emit-vm.cpp`, `ByteCodeEmitter::addConstantValue(IRConstant*)` follows a strict contract:

1. Reserve `operand.offset` and `operand.size` from `getNaturalSizeAndAlignment(targetReq, inst->getDataType(), &sizeAlignment)`.
2. Each switch arm **must** append exactly `sizeAlignment.size` bytes to `byteCodeBuilder.constantSection`.

If an arm writes fewer bytes (or no bytes), the next constant overlaps and the trailing-most operand reads OOB on `Ret`, segfaulting the VM with a message like:

```
VM operand access out of bounds in constants section: offset=N size=M sectionSize=N+K
```

## Common pitfall — `bool`

`IRBoolLit` carries a 1-bit value, but the `bool` type's natural size on common targets is 4 bytes. Writing one byte (e.g. `addRange(&byteValue, sizeof(byteValue))`) reproduces the OOB. The correct pattern mirrors `IntLit`:

```cpp
case kIROp_BoolLit:
    {
        int64_t value = static_cast<IRBoolLit*>(inst)->getValue() ? 1 : 0;
        byteCodeBuilder.constantSection.addRange((uint8_t*)&value, sizeAlignment.size);
        operand.setType(OperandDataType::General);
        break;
    }
```

On little-endian targets the low bytes of `value` carry 0/1 at any size the type-layout pass picks.

## Defensive arm

Add `default: SLANG_UNEXPECTED("unhandled IRConstant op in VM emitter");` so the next missing op fails at emit time instead of as a VM crash. The current op coverage is `StringLit`, `IntLit`, `FloatLit`, `PtrLit`, `BoolLit`, `VoidLit` — anything else hits the default.

## Adjacent slangi gap (informational, not the same bug)

While testing the bool fix, `slangi` also crashes on `printf("%s", x ? "T" : "F")` — a separate codegen issue unrelated to BoolLit. Use `if (x) printf("T"); else printf("F");` instead in interpreter regression tests until that's fixed.
