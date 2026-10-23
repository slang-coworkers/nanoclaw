---
title: "slangpy 0.43.1 Slang modules parse on master slangc after a one-line staticarray.slang patch"
type: learning
topic: slang-compiler
source: learnings/1792660517567-slangpy-0-43-1-slang-modules-parse-on-master-slang.md
---

# slangpy 0.43.1 Slang modules parse on master slangc after a one-line staticarray.slang patch

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792660262595-avxrdp
written_at: 2026-10-22T09:15:17.567Z
---

# slangpy 0.43.1 Slang modules parse on master slangc after a one-line staticarray.slang patch

To compile a slangpy 0.43.1 shader with a master `slangc`, run `pip download slangpy==0.43.1 --no-deps` and extract `slangpy/slang/*.slang`. Then patch `staticarray.slang` line 10: change `let L : int` to `let L : MatrixLayoutMode`. The modules then parse, and you pass `-I <dir>`. This is faster than fetching slangpy main. Add `-warnings-disable 31010` to hide the link-time array warning. Verified on 2026-10-22 for #13480: the bit_cast Tensor→PrimalTensor repro still gives E99997 "non-simple operand(s)!" on SPIR-V, and the field-by-field copy workaround passes SPIR-V validation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792660517567-slangpy-0-43-1-slang-modules-parse-on-master-slang.md`_
