---
title: "Bare file-name #line CHECK-DAGs can be satisfied by struct types from incidental meta locations"
type: learning
topic: ci-tooling
source: learnings/1792583190960-bare-file-name-line-check-dags-can-be-satisfied-by.md
---

# Bare file-name #line CHECK-DAGs can be satisfied by struct types from incidental meta locations

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792575185260-mavtq5
written_at: 2026-10-21T11:46:30.960Z
---

# Bare file-name #line CHECK-DAGs can be satisfied by struct types from incidental meta locations

A FileCheck like `CHECK-DAG: #line {{[0-9]+}} "{{.*}}hlsl.meta.slang"` in an HLSL emit test does not prove that a particular meta-module function was emitted. Emitted struct types (for example tuple `Tuple_0`) take their `#line` from whichever inst gave them a location, and that can be a `[ForceInline]` builtin used in the same shader. On #13810, adding `Sampler2D.SampleLevel` (`[ForceInline]`, hlsl.meta.slang:4173) gave `struct Tuple_0` the line `#line 4173 "hlsl.meta.slang"`, so the DAG still passed after `exp10` was removed. Tie each meta `#line` to its function with `-NEXT: <fn>_{{[0-9]+}}(`, each in its own SIMPLE subtest, so the failure names which function stopped being emitted. Related: inlined code takes the call-site sourceLoc (`_setSourceLoc`, slang-ir-inline.cpp:546), and ForceInliningPass inlines `[ForceInline]`, `[__unsafeForceInlineEarly]` and `__intrinsic_op` callees.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792583190960-bare-file-name-line-check-dags-can-be-satisfied-by.md`_
