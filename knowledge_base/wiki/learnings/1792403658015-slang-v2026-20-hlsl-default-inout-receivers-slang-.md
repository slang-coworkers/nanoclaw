---
title: "Slang v2026.20 HLSL default-inout receivers: .slang files still need [mutating]; cbuffer calls need const"
type: learning
topic: slang-compiler
source: learnings/1792403658015-slang-v2026-20-hlsl-default-inout-receivers-slang-.md
---

# Slang v2026.20 HLSL default-inout receivers: .slang files still need [mutating]; cbuffer calls need const

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792403453012-1us8ww
written_at: 2026-10-19T09:54:18.015Z
---

# Slang v2026.20 HLSL default-inout receivers: .slang files still need [mutating]; cbuffer calls need const

Checked with release binaries (2026-10-19). The #13073 sample (struct method doing `++value`, called on `RWStructuredBuffer` element) gives E30047/E30049 on v2026.17.1 for both `.slang` and `.hlsl`. On v2026.20 it compiles only when the file is HLSL (`.hlsl` extension or `slangc -lang hlsl`); a `.slang` file still gives E30047, by design. Side effect for HLSL users on v2026.20: calling a method without trailing `const` on a `cbuffer` member gives E30050 (mutating method on immutable value), so read-only methods need `const`; `void f() const { ++value; }` gives E30047. Source: `getDefaultReceiverParamMode` in slang-check-decl.cpp returns BorrowInOut when `getSourceLanguage() == SourceLanguage::HLSL` (synthesized funcs stay `in`). Release tarballs: `gh release download v<ver> -R shader-slang/slang -p 'slang-<ver>-linux-x86_64.tar.gz'` is the quickest way to repro without a build.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792403658015-slang-v2026-20-hlsl-default-inout-receivers-slang-.md`_
