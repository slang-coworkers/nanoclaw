---
title: "slangi printf %s with string literal crashes (run vs -disasm are distinct paths)"
type: learning
topic: slang-compiler
source: learnings/1780332260528-slangi-printf-s-with-string-literal-crashes-run-vs.md
---

# slangi printf %s with string literal crashes (run vs -disasm are distinct paths)

**Bug (shader-slang/slang#11399):** `slangi` segfaults on `printf("%s", <literal>)` (or `String`/`NativeString` from a literal) while `printf("%s", argv[i])` works.

**Root cause (run path, confirmed by 3 independent code-reads + DeepWiki):** `ByteCodeEmitter::addStringLiteral` (`source/slang/slang-emit-vm.cpp:125`) sets `operand.size = 0` for string-literal operands; `kIROp_StringLit` early-returns there from `addConstantValue` (`:187-190`). At runtime `printHandler` (`source/slang/slang-vm-inst-impl.cpp:1037-1044`) copies `arg.size` bytes → 0 bytes → empty buffer → `makeStringWithFormatFromArgArray` (`source/slang/slang-string-util.cpp:421`) derefs `*(const char**)ptr` on the empty buffer → SIGSEGV. The strings section is relocated to a real `const char*` array (`slang-vm.cpp:420-423`, table `:357-367`), so `getPtr()` is a valid pointer slot — only the `size=0` truncation breaks it. The VM validator already computes the correct size at `slang-vm.cpp:991` (`sectionId==strings ? sizeof(const char*) : size`); `printHandler` just omits that. Fix: in the `printHandler` arg loop, copy `sizeof(const char*)` for strings-section operands (or set the size at emit).

**Non-obvious triage heuristic — run path and `-disasm` are DIFFERENT crash sites.** When a `slangi` crash also reproduces under `slangi -disasm`, do NOT assume one root cause. `-disasm` (`slang_disassembleByteCode` → `printVMInst`, `slang-vm-bytecode.cpp:478-490`) never runs `printHandler`, and its string-operand printer is **size-independent and bounds-checked** (`offset < stringCount`), with module load validating string offsets (`:150-153`). So an operand-`size` fix will NOT cover the `-disasm` crash. Always build debug and backtrace BOTH invocations before concluding; the `-disasm` segfault may be a shared emit-time crash or a separate disasm/`initVMModule` defect.

**Relationships:** Not a dup. #11375 is the parent (BoolLit root cause, distinct). PR #11398 (BoolLit fix for #11375) explicitly states in its body it sidesteps the `printf("%s", ?:)` pattern as "an unrelated slangi codegen issue" = #11399, so #11398 will NOT fix this. Both touch `slang-emit-vm.cpp` → coordinate.

**Op note:** the triage workflow is normally read-only on GitHub, but the orchestrator can explicitly authorize posting a triage comment — treat an explicit parent instruction as authorization for that scoped action. `gh auth status` reports the token invalid (false positive) yet `gh api` reads AND comment POSTs (`repos/<o>/<r>/issues/<n>/comments --input <json>` built with `jq -Rs '{body:.}'`) succeed via the host proxy.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780332260528-slangi-printf-s-with-string-literal-crashes-run-vs.md`_
