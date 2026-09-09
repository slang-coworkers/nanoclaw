---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786526544975-xnez8b
written_at: 2026-08-12T12:52:04.882Z
---

# slangi VM Call opcode over-reads args by callee param-slot stride (not operand size) — OOB is layout-dependent

## slangi bytecode VM: `Call` sizes args by the CALLEE param-slot, an outlier vs Print/CallExt

**Bug family (shared with #12124, but working-set section instead of constants):** the VM `Call` opcode reads/copies each argument sized by the **callee's parameter-slot stride** (`func.m_parameterOffsets[i+1]-func.m_parameterOffsets[i]`), NOT the argument operand's own `.size`:
- validator: `source/slang/slang-vm.cpp:975` (`check(i+2, parameterSize, Read)`, no `min`)
- executor: `source/slang/slang-vm-inst-impl.cpp:495` (`memcpy(dst, src, nextParamOffset - parameterOffsets[i])`)

By contrast, `Print` (`slang-vm.cpp:989-995`) and `CallExt` (`:949-955`) size a non-string operand by `inst->getOperand(i).size` — the operand's OWN size. So `Call` is the one opcode that trusts the callee slot. When a call arg is smaller than its (alignment-padded) callee slot AND sits in the caller's last working-set slot, the read spills past the section → `VM operand access out of bounds in working set section` exit 5.

**#12496 concrete case:** `__bwd_diff` of `[Differentiable] float f(float x){return x*x;}`. The synthesized backward-prop `s_bwdProp_f` takes `inout DifferentialPair<float>` (param0). Its slot is 8 bytes (padded — param1 is a pointer needing 8-byte align), but the caller emits arg0 as a 4-byte float (`copy.4`). VM reads 8 bytes of a 4-byte operand.

**⭐ The crash is LAYOUT-DEPENDENT, not "on every bwd_diff" (the issue title overstated it).** Rebuild-free counterfactual via `slangi -disasm`: `x*x`/`x*x*x` abort, but `x+x` and two-param `x*y+x` RUN and return correct gradients — they execute the *same* 8-byte read of a 4-byte arg but the extra bytes are inert alignment padding the callee never reads (callee reads param0 only at offset 0). It faults ONLY when that padding lands at the section boundary. ⇒ **a "the VM over-reads N bytes" bug fires only when the over-read crosses a section edge; most of the time it silently reads dead padding.** This is why the consumer-side clamp (`min(operand.size, slotSize)`) is NOT masking a truncated value here — the working cases prove the bytes are dead.

**Method:** `slangi -disasm` still runs the operand validator (prints the OOB) then dumps the bytecode — so you get the crash line + full disasm in one run, no rebuild, no debugger. That disasm across a working vs crashing case IS the counterfactual the "root-cause from IR + counterfactual, not disasm alone" rule (#12124) asks for.

`__fwd_diff` and CPU-compile both work because only the VM `Call` path enforces this slot-size contract. #12127 (the #12124 fix) touched `slang-emit-vm.cpp`/`slang-emit.cpp`, NOT these two VM lines.
