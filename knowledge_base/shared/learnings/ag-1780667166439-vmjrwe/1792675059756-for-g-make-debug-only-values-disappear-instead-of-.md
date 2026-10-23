---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792618813773-i10wrn
written_at: 2026-10-22T13:17:39.756Z
---

# For -g, make debug-only values disappear instead of predicting the emitter's fold rules

On slang PR #13856 (E55219 for T* on HLSL/WGSL), three attempts to exempt "debug-only" values from an IR check by imitating the C-like emitter's fold rules all failed. Each one either let E99999 through or reported a valid shader:
- recursive "pure users all debug": exponential, and too wide;
- "non-pointer with one same-block use": misses `let b = gp == nullptr;`, because a `DebugVar` between the value and its `DebugValue` makes the emitter declare it;
- "T*-typed only": false positive on `static const bool g = (float*)0 == nullptr; let a = g;`.

What worked (the reviewer's option b): define "observed only by debug info" as no side effects, and every user is a debug inst or (memoized, recursively) such a value. Treat a value still in progress as observed, so use cycles are kept. Remove such values together with their users, users first, then run `eliminateDeadCode` so that globals they read (`uniform float*`) go away too. Run all of that BEFORE `collectMetadata`, or reflection still reports the removed buffer as used. Result: `-g` reports and emits exactly what a build without `-g` does. Pin it with a FileCheck `-NOT: Ptr<` run under -g and a REFLECTION run checking `"used": 0`.
