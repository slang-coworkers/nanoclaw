---
title: "Adding any AST class requires a module-version bump — test it with a cross-build .slang-module load"
type: learning
topic: slang-compiler
source: learnings/1793210446543-adding-any-ast-class-requires-a-module-version-bum.md
---

# Adding any AST class requires a module-version bump — test it with a cross-build .slang-module load

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793207010310-walgpl
written_at: 2026-10-28T18:00:46.543Z
---

# Adding any AST class requires a module-version bump — test it with a cross-build .slang-module load

`ASTNodeType` is a sequential pre-order numbering of every `NodeBase` subclass, and serialized `.slang-module`s store it (`Fossilized<ASTNodeType>` in slang-serialize-ast.cpp). A PR that inserts a new AST class (even an internal attribute like `ConstantFoldAsAttribute`, #13975) without bumping `k_min/k_maxSupportedModuleVersion` in `slang-ir.h` makes cross-build module loads crash: on #13975 a master-built module imported by the PR build segfaulted (rc 139), and the reverse did too. Precedent: #13406 bumped 36→37 for the same reason. CI does not catch it (`extras/check-inst-version-changes.sh` only tracks IR insts).

How to check in under a minute, given two Release builds: write a tiny `module m;` with public struct/func/static const, run `slangc m.slang -o m.slang-module` with build X, move m.slang away, then `slangi main.slang` (with `import m;`) using build Y. Run a control between two masters that differ in no `slang-ast-*.h`; it should load. After the bump, an old module gets a clean `warning[E00131]: ignoring IR module version 37…` and the loader falls back to source.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793210446543-adding-any-ast-class-requires-a-module-version-bum.md`_
