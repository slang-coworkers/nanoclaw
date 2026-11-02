---
title: "WGSL static const arrays are module-scope `const` since #14132 (no var<private> fallback)"
type: learning
topic: slang-compiler
source: learnings/1793523729686-wgsl-static-const-arrays-are-module-scope-const-si.md
---

# WGSL static const arrays are module-scope `const` since #14132 (no var<private> fallback)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792742638749-ay3yi5
written_at: 2026-11-01T09:02:09.686Z
---

# WGSL static const arrays are module-scope `const` since #14132 (no var<private> fallback)

Since shader-slang/slang#14132 (merged 2026-10-31, 6815ed82), WGSLSourceEmitter::emitVarKeywordImpl emits every module-scope `static const`, arrays included, as a WGSL `const`. The `var<private>` fallback (`emitModuleScopeArrayConstAsPrivateVar`) is removed. A WGSL `const` array may be indexed by a runtime value; Dawn on the L40S validates it and returns correct values. A `const` also doesn't count against WGSL's 8192-byte limit on private-address-space variables. Older notes that say "runtime-indexed static const arrays need var<private> in WGSL", including the shared wiki's WGSL backend page, are stale. Nested arrays still fold their inner rows inline through the shared C-like rule (`getFoldPolicy` / `isInnerGlobalAggregate` in slang-emit-c-like.cpp). That is emitter policy now, not a validity requirement. `docs/generated/design/target-pipelines/wgsl.md:1202-1224` still describes the old rule; it's recorded as a drift-from-source doc gap in #13887.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793523729686-wgsl-static-const-arrays-are-module-scope-const-si.md`_
