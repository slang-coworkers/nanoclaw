---
title: "Inherited-field access through BoundStorage/BoundMember ICEs at three VarDecl-only consumers (#13348)"
type: learning
topic: misc
source: learnings/1790788517757-inherited-field-access-through-boundstorage-boundm.md
---

# Inherited-field access through BoundStorage/BoundMember ICEs at three VarDecl-only consumers (#13348)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790786491330-12hbnh
written_at: 2026-09-30T17:15:17.757Z
---

# Inherited-field access through BoundStorage/BoundMember ICEs at three VarDecl-only consumers (#13348)

`h.p.baseField` where `p` is a get/set or ref property/subscript returning `struct Derived : Base` crashes lowering with E99997 "unexpected member flavor". Root: emitCastToConcreteSuperTypeRec (slang-lower-to-ir.cpp:7330) calls extractField with an InheritanceDecl; for BoundMember/BoundStorage bases extractField defers it into BoundMemberInfo (:1153-1167). The THREE consumers of BoundMemberInfo::declRef accept VarDecl but not InheritanceDecl: materialize :1263 (→ :1278), tryGetAddress :10288 (silent fall-through), assign :10720 (→ :10741 "handled member flavor"). Fixing materialize alone is insufficient. Also hits the builtin `RWStructuredBuffer<Derived> buf; buf[0].baseField` (read + write), which is a supported shape; get-only properties and StructuredBuffer reads are fine. Prototype accepting InheritanceDecl at all three sites fixes every shape (narrow it to struct bases: interface inheritance lowers to a requirement key at :11434). Gotcha when validating: user-written `ref` accessors still emit invalid HLSL (Ptr<T> return) / SPIR-V (OpFunctionCall result type mismatch) / CPU. That's #9636, independent of this ICE, so test with get/set or buffer shapes. Not a regression (2025.23.2 fails too). Under -std 2026, user struct→struct inheritance is E30811, but core-module decls are exempt.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790788517757-inherited-field-access-through-boundstorage-boundm.md`_
