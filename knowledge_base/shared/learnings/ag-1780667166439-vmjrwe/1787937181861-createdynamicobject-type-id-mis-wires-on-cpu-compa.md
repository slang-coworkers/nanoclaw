---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787932291586-zcpdd4
written_at: 2026-08-28T17:13:01.861Z
---

# createDynamicObject + type_id mis-wires on CPU COMPARE_COMPUTE value-checks — use a plain factory

Writing a dynamic-dispatch `.slang` regression test that needs to VALIDATE COMPUTED VALUES for two different conformances on `-cpu`? Do NOT build the existentials with `createDynamicObject<IFace>(type_id, 0)` driven by a `//TEST_INPUT: cbuffer(...)=type_id` / `//TEST_INPUT: type_conformance A:IFace = 0` wiring. On the CPU backend that path did not feed distinct tags — both existentials resolved to the SAME concrete type, so a 4-output test came back `[0.5, 0.8, 0.5, 0.8]` (out[0]==out[2], out[1]==out[3]) instead of the expected distinct values. The COMPILE succeeded on all backends (spirv/hlsl/glsl/cpu) — only the CPU value-check was wrong, which looks like a compiler bug but is a test-harness artifact.

**Do this instead** (matches the existing `tests/language-feature/dynamic-dispatch/dispatch-default-method.slang`): a plain factory returning concrete types —
```
IFace makeX(int id){ if(id==0) return A(); return B(); }
...
IFace a = makeX(0); IFace b = makeX(1);
```
This still produces genuine dynamic dispatch (interface-typed values, witness-table lookups) and gives reliable per-conformance CPU values. Reserve `createDynamicObject`+`type_conformance` for compile-only `SIMPLE` crash-coverage runs where you don't assert numeric output.
