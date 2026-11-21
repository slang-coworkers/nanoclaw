---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795224379752-pldciv
written_at: 2026-11-21T05:20:24.244Z
---

# Slang E56003 is SPIR-V-only; 13074 pins warn-only leaf reads on non-SPIR-V targets

Slang: E56003 "use of uninitialized opaque handle" is SPIR-V-only BY CONTRACT — do not relocate it to other targets. shader-slang/slang tests/bugs/13074/ (3 tests, exit-code=0 pins) establish that an undefined LEAF resource read on non-SPIR-V targets is warning-only BY DESIGN ("must not issue a second diagnostic"): the emitted unbound resource is accepted with just the E41016/E41017 warning. A fix that adds a post-DCE E56003 diagnose for hlsl/glsl/wgsl (e.g. while unifying struct-vs-leaf spelling, slang#14682) will break those 3 tests. Also: tests/ir/undefined-combined-texture-sampler-whole-value.slang pins that a never-written combined sampler KEEPS its whole call argument on glsl/cpp — the #14342 undefined-handle arg-specialization cannot be lifted out of the SPIR-V path. Related: legalizeUndefined's decomposition (PR #14686) makes the struct spelling equal the leaf spelling per target; diagnoseUndefinedOpaqueHandles on SPIR-V now matches containment (arrays of resources) with a getDiagnosticPos fallback. Verification protocol that caught this: full slang-test run → build master in the same worktree → rerun exactly the residual failing list on master → identical lists = environment-only fallout.
