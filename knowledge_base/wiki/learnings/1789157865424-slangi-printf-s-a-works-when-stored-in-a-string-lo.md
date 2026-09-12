---
title: "slangi printf %s: a 'works when stored in a String local' claim can be a constant-folding artifact, not inline-vs-local"
type: learning
topic: slang-compiler
source: learnings/1789157865424-slangi-printf-s-a-works-when-stored-in-a-string-lo.md
---

# slangi printf %s: a "works when stored in a String local" claim can be a constant-folding artifact, not inline-vs-local

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789156900397-mu3zho
written_at: 2026-09-11T20:17:45.424Z
---

# slangi printf %s: a "works when stored in a String local" claim can be a constant-folding artifact, not inline-vs-local

When triaging a slangi (byte-code interpreter) crash where `printf("%s", cond ? "a" : "b")` segfaults but "storing the result in a `String` local first works", do NOT trust the inline-vs-local framing — verify with a *runtime* condition. In shader-slang/slang#13017 the reporter's working local example used `(1 < 2)` (a compile-time-constant condition), which constant-folds the ternary to a single string literal → the literal becomes a strings-section operand and works. Their crashing inline example used a runtime function-call condition. The true axis is **constant-foldable literal vs. genuinely-runtime `String` value**: a runtime-cond local, an `if`-statement-assigned local, and a `String` returned from a function ALL segfault identically.

Root cause: `kIROp_StringType` has no HostVM size (`slang-ir-layout.cpp:425-432` returns a size only when `stringSize != 0`, which is 0 for the VM — see the comment at `slang-emit-vm.cpp:706-708` "StringType has no configured HostVM size, but a NativeString field is pointer-sized"). So any runtime `String` value lands in a 0-byte working-set slot; the copy moves 0/garbage bytes and `printf`'s `%s` (`slang-emit-vm.cpp:1204-1223` → `slang-vm-inst-impl.cpp` `makeStringWithFormatFromArgArray`) dereferences that garbage as `const char*` → SIGSEGV. String *literals* work only because they route through `addStringLiteral` (`slang-emit-vm.cpp:118-131`) as a strings-section operand. Contrast `NativeStringType`, which is pointer-sized (`slang-ir-layout.cpp:412`).

Triage lesson: reproduce the isolation matrix yourself (constant-cond inline, constant-cond local, runtime-cond inline, runtime-cond local, fn-return) before repeating a reporter's inline-vs-local hypothesis — a constant-fold can masquerade as a codegen distinction. Related closed issue #11399 fixed the plain-literal `%s` size=0 case but its fix did not cover the runtime-String sub-case.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789157865424-slangi-printf-s-a-works-when-stored-in-a-string-lo.md`_
