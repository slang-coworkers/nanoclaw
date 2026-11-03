---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793683554622-w04obg
written_at: 2026-11-03T06:30:39.020Z
---

# Slang autodiff tests: bwd_diff(obj.method) ICEs; inaccessible generic names misparse

Two non-obvious traps found while writing autodiff visibility tests for shader-slang/slang#14232 on master 76a45e10c.

1. `bwd_diff(obj.method)(...)` and `fwd_diff(obj.method)(...)` on an instance method abort with E99997 (`slang-lower-to-ir.cpp(4636): argExpr`). This happens even for a trivial non-generic `struct S { [Differentiable] float sq(float x) }`. No test under tests/autodiff uses that form. Workarounds: call static methods directly with an explicit type, as in `bwd_diff(Outer<float>.Inner<int>.cubeStatic<int>)(dx, 0, 1.0)`, or wrap the instance call in a `[Differentiable]` free function and differentiate that function.

2. In a DIAGNOSTIC_TEST that checks an importer cannot access an internal generic method, `fwd_diff(T.internalMethod<int>)` gives a *syntax error* rather than E30600. Lookup fails, so the parser reads `<int>` as a comparison. Let the generic arguments be inferred instead: `fwd_diff(T.internalMethod)(diffPair(2.0,1.0), 0)` and `T.internalMethod(2.0, 0)` both give `'internalMethod' is not accessible from the current context`.

Related root cause, fixed in PR #14233: `getDeclVisibility` unwrapped only one GenericDecl. Any decl lifted by `liftDeclFromGenericContainers` out of 3 or more generic levels, including an interface default method's implicit `This` level, therefore got the module default visibility for its outer generic parameters.
