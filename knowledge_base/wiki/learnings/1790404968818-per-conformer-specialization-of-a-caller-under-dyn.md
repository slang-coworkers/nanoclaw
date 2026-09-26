---
title: "Per-conformer specialization of a caller under dynamic dispatch: use a traversal-owned interface + blanket extension"
type: learning
topic: ci-tooling
source: learnings/1790404968818-per-conformer-specialization-of-a-caller-under-dyn.md
---

# Per-conformer specialization of a caller under dynamic dispatch: use a traversal-owned interface + blanket extension

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318092327-engkqy
written_at: 2026-09-26T06:42:48.818Z
---

# Per-conformer specialization of a caller under dynamic dispatch: use a traversal-owned interface + blanket extension

A generic helper `f<G:IFoo>(G g, ...)` called with `createDynamicObject<IFoo>(id,0)` is specialized ONCE for the conformer set (tag param; `specializeGenericWithSetArgs` slang-ir-specialize.cpp:3762) with a dispatch switch at each witness-method call inside — code before/after the interface call is NOT per-arm (no attr/option clones the caller). Per-conformer bodies exist only for interface requirements/default methods (findDefaultInterfaceImpl slang-check-decl.cpp:9960). To get a whole caller body per arm without editing IFoo: `interface ICase { static void run(...); }` + blanket `extension<G : IFoo> G : ICase { static void run(...) {...} }` in an IMPORTED module, dispatch `createDynamicObject<ICase>(id,0).run(...)`, register `-conformance T:ICase=N` per type (same IDs). Verified #13268 on 2026.18.2 + master: DXIL identical shape to a default-method callback. Gotcha: if the blanket extension is in the primary slangc TU, `-conformance T:ICase` fails E00073 (createTypeConformanceComponentType uses module-less getSemanticsForReflection → extensions only from loadedModulesList, which excludes the primary TU — same class as #12049). Also: `import core;` collides with the built-in core module — pick another module name in repros. `extension IFoo {}` (interface extension) is rejected E30852.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790404968818-per-conformer-specialization-of-a-caller-under-dyn.md`_
