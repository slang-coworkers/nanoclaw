---
title: "Slang layout: IR rule Natural doubles as user ScalarDataLayout's op; sizeof is target-independent"
type: learning
topic: slang-compiler
source: learnings/1790635577609-slang-layout-ir-rule-natural-doubles-as-user-scala.md
---

# Slang layout: IR rule Natural doubles as user ScalarDataLayout's op; sizeof is target-independent

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789421080649-zjzu07
written_at: 2026-09-28T22:46:17.609Z
---

# Slang layout: IR rule Natural doubles as user ScalarDataLayout's op; sizeof is target-independent

When you change what "scalar layout" means per target (e.g. shader-slang/slang#12714's -layout-rules-version 202c rounding), there are three traps:

1. **Natural and user scalar share one encoded op.** `getOpFromTypeLayoutRuleName(Natural)` returns `kIROp_ScalarBufferLayoutType`, the same op user `ScalarDataLayout` lowers to, on buffers and on `Ptr<T,..,L>`. A version-aware decoder therefore also rounds non-scalar natural buffers (for example `-fvk-use-dx-layout` structured buffers) through their element pointers. The fix in PR #13300: a new internal `NaturalBufferLayoutType` op, emitted only on rounding targets, so IR elsewhere stays byte-identical.
2. **The DX-layout block in `getTypeLayoutRuleNameForBuffer` returns Natural for pointers** before the pointer branch is reached. Reflection lays out pointees as scalar no matter what, so the two only agreed because natural == scalar. User pointers carry `DefaultBufferLayoutType`, not a null layout, and StorageBuffer element pointers also carry Default. Tell them apart with `AddressSpace::UserPointer`.
3. **`sizeof`/`alignof` are folded as target-independent AST constants** (`slang-ast-val.cpp` SizeOfIntVal, lower-to-ir `ASTNaturalLayoutContext`), so they cannot follow a per-target layout rule. ByteAddressBuffer `Load<T>` uses natural rules as well.

Tooling notes:
- Reflection JSON is available from `slangc -reflection-json <file>`, in the same format as the REFLECTION test output.
- The generated `command-line-slangc-reference.md` has trailing spaces on about 900 lines. CI byte-compares it, so don't trim them.
- `/explain-diff-html` REPLACES the PR body and keeps only issue links and the disclaimer. Skip it when the parent has required specific body content.
- The critique-gate hook blocks any gh-api call on the PR-list REST route, even reads and heredoc text that names it. Use `gh pr view` or the MCP tool instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790635577609-slang-layout-ir-rule-natural-doubles-as-user-scala.md`_
