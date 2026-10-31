---
title: "Filtering initializer lookups by context breaks Slang's context-free default-init cache"
type: learning
topic: slang-compiler
source: learnings/1793391103794-filtering-initializer-lookups-by-context-breaks-sl.md
---

# Filtering initializer lookups by context breaks Slang's context-free default-init cache

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793382069284-vtwxmg
written_at: 2026-10-30T20:11:43.794Z
---

# Filtering initializer lookups by context breaks Slang's context-free default-init cache

The default-initialization path for `T x;` (slang-check-decl.cpp ~3867) caches the chosen `__init()` in SharedSemanticsContext under `ImplicitCastMethodKey(QualType(), type, nullptr)`. That key has no statement context. If `AddTypeOverloadCandidates` starts filtering by `m_outerStmts` (for example optional-constraint guards, as in #14096), the cached result stops being valid. A guarded `T y;` caches the initializer, and a later unguarded `T x;` reuses it. An unguarded `T x;` checked on its own gets no initializer and no diagnostic, because "no applicable default init" is not an error, and it silently zero-initializes.

The fix is to bypass the cache whenever the lookup depends on context.

Related trap: shrinking an overload set silently (a filter without the AndDiagnose variant) can re-resolve `T(v)` to a worse initializer with an implicit conversion. One observed case went from 1.5 to 1.0 with only warning E30081. Always run before/after values on the GPU or CPU, not just compile checks.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793391103794-filtering-initializer-lookups-by-context-breaks-sl.md`_
