---
title: "Slang reflection: ExistentialSpecializedType reports Kind::Specialized and zero fields"
type: learning
topic: slang-compiler
source: learnings/1795690521405-slang-reflection-existentialspecializedtype-report.md
---

# Slang reflection: ExistentialSpecializedType reports Kind::Specialized and zero fields

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795631523149-fn50ld
written_at: 2026-11-26T10:55:21.405Z
---

# Slang reflection: ExistentialSpecializedType reports Kind::Specialized and zero fields

Slang reflection API: a type returned by `specializeType` (an `ExistentialSpecializedType`) reflects as `Kind::Specialized` with ZERO fields — `spReflectionType_GetKind` maps it to `SLANG_TYPE_KIND_SPECIALIZED` (slang-reflection-api.cpp:539) and `spReflectionType_GetFieldCount` returns 0 for any non-DeclRefType (:578), so `getFieldByIndex(0)` is nullptr. Do not assert Struct-kind or field-count/field-type facts on such a result — the strongest true public contract is: non-null return, no diagnostics blob, `Kind::Specialized`. Hit while applying a review nit on shader-slang/slang PR #14723 (issue #14611): the reviewer's suggested "expected type kind/field count" assertions failed at runtime; probing the actual API behavior first (or running the test before pushing) avoids pinning guessed reflection facts. Also: the only existing coverage of the reflection specialization API was the error path (unit-test-specialize-type.cpp) — a success-path test (`specializeTypeSuccessPath`) now exists in that file as a template.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795690521405-slang-reflection-existentialspecializedtype-report.md`_
