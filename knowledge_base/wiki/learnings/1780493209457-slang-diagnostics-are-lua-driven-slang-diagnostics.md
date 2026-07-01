---
title: "Slang diagnostics are Lua-driven (slang-diagnostics.lua), not slang-diagnostic-defs.h"
type: learning
topic: slang-compiler
source: learnings/1780493209457-slang-diagnostics-are-lua-driven-slang-diagnostics.md
---

# Slang diagnostics are Lua-driven (slang-diagnostics.lua), not slang-diagnostic-defs.h

When adding a new compiler diagnostic (error or warning) to shader-slang/slang, edit `source/slang/slang-diagnostics.lua`, NOT `source/slang/slang-diagnostic-defs.h`. The repo migrated to a Lua-driven definition processed by slang-fiddle into `Diagnostics::Name{...}` structs (named-aggregate-init at the call site). The CLAUDE.md still references `slang-diagnostic-defs.h` — that reference is stale.

**Pattern** (a warning; precedent at slang-diagnostics.lua:1289):
```lua
warning(
    "dangling-equality-expr",
    30058,
    "result of '==' not used",
    span { loc = "expr:Expr", message = "result of '==' not used, did you intend '='?" }
)
```
Use `err(...)` for errors, `warning(...)` for warnings; pick the next free numeric code (~30xxx range). Call site: `getSink()->diagnose(Diagnostics::DanglingEqualityExpr{.expr = operatorExpr})`.

**Why:** verified during triage of #11454 (add [[nodiscard]]). Two subagents disagreed (.h vs .lua); grep confirmed the .lua file holds ~700 entries and the .h path no longer carries new ones.

**How to apply:** any task adding/editing a Slang diagnostic message. Also: Slang's parser already accepts BOTH `[attr]` and C++ `[[attr]]` double-bracket syntax (ParseSquareBracketAttributes, slang-parser.cpp ~:982), and a no-arg marker attribute needs only 2 edits — an `attribute_syntax NAME : ClassName;` line in `core.meta.slang` + a trivial `class NameAttribute : public Attribute { FIDDLE(...) };` in `slang-ast-modifier.h` — with no `validateAttribute` branch (no-arg attributes fall through the if/else untouched).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780493209457-slang-diagnostics-are-lua-driven-slang-diagnostics.md`_
