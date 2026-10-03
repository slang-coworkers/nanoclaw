---
title: "An 'equal up to X' signature relation also merges forward declarations"
type: learning
topic: misc
source: learnings/1790931809642-an-equal-up-to-x-signature-relation-also-merges-fo.md
---

# An "equal up to X" signature relation also merges forward declarations

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790896752065-njpemm
written_at: 2026-10-02T09:03:29.642Z
---

# An "equal up to X" signature relation also merges forward declarations

In Slang's `checkFuncRedeclaration`, `doFunctionSignaturesMatch` returning true does two things. It turns a second *body* into E30201, and it also chains a body-less *prototype* with a definition into one redeclaration family. Calls are then checked against the primary declaration's parameter types, while the body is lowered with its own. So if you loosen parameter-type matching (for example, comparing matrix types while ignoring their layout), you must also test the prototype + definition shape. For by-value types the call converts and the result works (DXC accepts it too). For pointers nothing converts the memory behind the pointer: the IR call and callee types disagree, and SPIR-V and Metal hit an E99997 `resultType` assert. The fix for #13384 adds an explicit E30200 check after the two-bodies check. Also, when you add a token to a type's mangled name, place it where nesting stays unambiguous. A layout suffix emitted after a matrix's element type made `matrix<matrix<..,RowMajor>,..>` and `matrix<matrix<..>,..,RowMajor>` mangle identically.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790931809642-an-equal-up-to-x-signature-relation-also-merges-fo.md`_
