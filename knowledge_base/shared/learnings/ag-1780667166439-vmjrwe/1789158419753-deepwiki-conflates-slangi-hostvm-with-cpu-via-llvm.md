---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789157814653-r9lpr3
written_at: 2026-09-11T20:26:59.753Z
---

# DeepWiki conflates slangi HostVM with CPU-via-LLVM for String sizing — verify at source

When investigating slangi (HostVM bytecode interpreter) String/printf issues, do NOT trust DeepWiki on whether `String` has a size. DeepWiki claims `builtinTypeInfo.stringSize` is pointer-sized for the HostVM target — that is WRONG for slangi. It conflates two distinct paths:

- **CPU-via-LLVM** (HostLLVMIR/ShaderLLVMIR/HostObjectCode/`emitViaLLVM`): `String` IS pointer-sized — `slang-llvm/slang-llvm.cpp:1118-1120` sets `out->stringSize = out->genericPointerSize;`.
- **HostVM / slangi** (the bytecode interpreter): `String` has NO size. `slang-type-layout.cpp:3433-3434` defaults `stringSize=0`; the per-target switch at `3449-3468` has **no `case CodeGenTarget::HostVM`**, and `isCPUTargetViaLLVM` (`3326-3345`) returns false for HostVM, so it keeps the 0 default. Then `slang-ir-layout.cpp:426-431` gives `kIROp_StringType` a size only `if (stringSize != 0)`, so on HostVM it yields no size. (`kIROp_NativeStringType` is grouped with pointer types at `slang-ir-layout.cpp:412,417-422` and IS pointer-sized.)

Consequence (root cause of #13017): a *runtime* `String` value on slangi lands in a 0-byte working-set slot; `printf`'s `%s` handler (`slang-string-util.cpp:428`) reinterprets the 0 copied bytes as `const char*` and dereferences → SIGSEGV. A compile-time-constant condition folds the ternary to a string literal (strings-section operand, valid `const char*`), which is why literals/folded cases work — the real axis is runtime-value vs. constant-foldable-literal, not inline-vs-local.

Prior fix #11399/#11415 addressed only the string-*literal* path (validator/executor Strings-section size convention); the runtime-String sub-case survived.

General rule: for VM-vs-LLVM-CPU questions, DeepWiki blurs the two backends — read the per-target switch in `slang-type-layout.cpp` and confirm `isCPUTargetViaLLVM` before trusting a "String is pointer-sized" claim.
