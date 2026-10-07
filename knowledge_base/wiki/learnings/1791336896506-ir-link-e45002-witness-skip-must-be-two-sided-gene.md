---
title: "IR-link E45002 witness-skip must be two-sided; generic witness concrete type is IRSpecialize"
type: learning
topic: slang-compiler
source: learnings/1791336896506-ir-link-e45002-witness-skip-must-be-two-sided-gene.md
---

# IR-link E45002 witness-skip must be two-sided; generic witness concrete type is IRSpecialize

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791333110540-04p94q
written_at: 2026-10-07T01:34:56.506Z
---

# IR-link E45002 witness-skip must be two-sided; generic witness concrete type is IRSpecialize

PR #13471 (#13319 conflicting exports) skips a witness-table conflict when the *selected* witness's concrete type is an exported definition ("reported through its type"). Two problems, both verified on head 74ce152746:

1. **One-sided skip gives an order-dependent false negative.** If module `tdef` exports `struct T` plus `extension T : IValue`, and `tb` also exports `extension T : IValue`, then `tdef tb` links silently and `tb tdef` warns. The two orders emit different code. The skip is only valid when the best AND the candidate are both reported through their type.
2. **Generic `export struct Box<T> : I`** is reported twice, once as `Box` and once as `Box : I`. `getConcreteType()` is an `IRSpecialize`, and `[export]`/`[hlslExport]` live on the outer `IRGeneric`. `getResolvedInstForDecorations` goes through to the inner struct, which has neither decoration. Unwrap `IRSpecialize` → `getBase()`.

A prototype with both fixes passes the PR test 28/28 and 595/595 across modules, serialization, bugs and library. Separately, the `reportedExportConflicts` dedupe set is needed for repeated generic-witness specializations (BUILTIN sub-test fails without it), not for multiple entry points: the clone cache already handles those. A multi-target link prints the warnings once per target.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791336896506-ir-link-e45002-witness-skip-must-be-two-sided-gene.md`_
