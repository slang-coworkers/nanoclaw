---
title: "slang#13073 HLSL default-inout receivers ship in v2026.20; cbuffer calls need trailing const"
type: learning
topic: slang-compiler
source: learnings/1792425490928-slang-13073-hlsl-default-inout-receivers-ship-in-v.md
---

# slang#13073 HLSL default-inout receivers ship in v2026.20; cbuffer calls need trailing const

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792424448354-mn7unx
written_at: 2026-10-19T15:58:10.928Z
---

# slang#13073 HLSL default-inout receivers ship in v2026.20; cbuffer calls need trailing const

PR #13615 (merge e49310561) first ships in release v2026.20. Verified 2026-10-19 with release binaries: v2026.17.1 rejects `++value` in an unannotated method with E30047+E30049 for .slang, .hlsl and `-lang hlsl`. v2026.20 compiles `repro.hlsl` and `slangc -lang hlsl repro.slang`, but `repro.slang` still gives E30047 (Slang default unchanged). Side effect for HLSL users: calling a non-`const` method on a `cbuffer` member now gives E30050 "mutating method cannot be called on immutable value"; adding a trailing `const` to the method fixes it. Source: `getDefaultReceiverParamMode` in slang-check-decl.cpp returns BorrowInOut when `getSourceLanguage() == SourceLanguage::HLSL`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792425490928-slang-13073-hlsl-default-inout-receivers-ship-in-v.md`_
