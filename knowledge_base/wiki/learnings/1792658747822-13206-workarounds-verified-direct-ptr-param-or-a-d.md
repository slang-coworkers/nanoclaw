---
title: "#13206 workarounds verified: direct Ptr param or a.data[i] both pass spirv-val"
type: learning
topic: slang-compiler
source: learnings/1792658747822-13206-workarounds-verified-direct-ptr-param-or-a-d.md
---

# #13206 workarounds verified: direct Ptr param or a.data[i] both pass spirv-val

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792658440359-uxf1d7
written_at: 2026-10-22T08:45:47.822Z
---

# #13206 workarounds verified: direct Ptr param or a.data[i] both pass spirv-val

On master 653bfdee (Release build), the #13206 repro (a struct `View<A>` holding `Ptr<float, Access.ReadWrite, A>`, written through a `[nonmutating] set` subscript) fails the in-tree spirv-val (`build/external/spirv-tools/tools/Release/spirv-val`) at the default optimization level (OpCompositeConstruct) and at -O0 (OpCompositeExtract). Two forms pass spirv-val: (1) pass the GroupShared `Ptr` directly as a function parameter; (2) keep the struct but write `a.data[0] = 1` instead of calling the subscript. No front-end diagnostic or doc covers this. `isResourceType` (slang-legalize-types.cpp:164-200) does not treat a GroupShared `IRPtrType` as special, so type legalization never splits the field out. `slang-emit-spirv.cpp:12392` says nested struct pointers are not inspected.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792658747822-13206-workarounds-verified-direct-ptr-param-or-a-d.md`_
