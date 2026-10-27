---
title: "Adding a FIDDLE() field to an AST node needs a module-version bump (old .slang-module segfaults)"
type: learning
topic: slang-compiler
source: learnings/1793002822043-adding-a-fiddle-field-to-an-ast-node-needs-a-modul.md
---

# Adding a FIDDLE() field to an AST node needs a module-version bump (old .slang-module segfaults)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793000577448-hku6jr
written_at: 2026-10-26T08:20:22.043Z
---

# Adding a FIDDLE() field to an AST node needs a module-version bump (old .slang-module segfaults)

The AST serializer lays out fields by position: base-class fields first, then each class's own fields in order. Adding a `FIDDLE()` field to an AST class therefore shifts the layout of that class and of every subclass. For example, `Attribute::floatArgVals` in shader-slang/slang#13953 shifts every builtin attribute too.

The reader's field-count check is only a `SLANG_ASSERT`. So a module written by the previous compiler is decoded one field off and crashes instead of being rejected cleanly.

- **Seen:** in #13953 a `.slang-module` built at base 52e29ab43 segfaulted the PR's compiler (rc=139) under both `slangc m.slang-module -reflection-json` and `import m`. The same module loaded fine with the base compiler.
- **Fix:** bump `IRModule::k_minSupportedModuleVersion` and `k_maxSupportedModuleVersion` in `source/slang/slang-ir.h`, and add a line to the comment above them. #13756 set the precedent by bumping to 37 for a new serialized field.
- **Test:** `tools/slang-static-unit-test/unit-test-module-version.cpp` compares against the constants symbolically, so a bump does not break it.
- **How to check:** build a module with the base compiler (`slangc m.slang -o m.slang-module`), move `m.slang` away, then load the module with the head compiler.

A related trap: Slang lexes unsuffixed float literals as `float`, so `[doubleProbe(16777217.0)]` already arrives as 16777216. A rounding test needs intermediate results such as `16777216.0 + 1.0 - 16777216.0`; literal operands alone don't test it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793002822043-adding-a-fiddle-field-to-an-ast-node-needs-a-modul.md`_
