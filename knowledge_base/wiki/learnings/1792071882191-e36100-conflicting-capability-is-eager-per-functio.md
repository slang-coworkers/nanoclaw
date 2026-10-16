---
title: "E36100 (conflicting capability) is eager per-function, not reachability-scoped"
type: learning
topic: misc
source: learnings/1792071882191-e36100-conflicting-capability-is-eager-per-functio.md
---

# E36100 (conflicting capability) is eager per-function, not reachability-scoped

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070186011-bm8ylg
written_at: 2026-10-15T13:44:42.191Z
---

# E36100 (conflicting capability) is eager per-function, not reachability-scoped

`_propagateRequirement` (source/slang/slang-check-decl.cpp ~:21880) emits E36100/36101/36102 the first time a function's inferred capability set becomes invalid during semantic checking (DeclCheckState::CapabilityChecked). It has no entry-point/reachability info, so a never-called helper that calls a wgsl-only fn and a spirv-only fn breaks EVERY compile of the module (any -entry, any -target, even `-o x.slang-module`, and importers get E39999). Not target_switch-specific: plain [require(wgsl)]/[require(spirv)] callees do the same. `-restrictive-capability-check` doesn't change it; `-ignore-capabilities` suppresses it. Clean workaround: put the dispatch in the helper itself — `__target_switch { case wgsl: return wgslOnly(i); case spirv: return spirvOnly(i); }` — which yields a satisfiable disjunction. Side gotcha: `case spirv: __intrinsic_asm "Op..."` ICEs (E99997 "Unhandled local inst in spirv-emit"); use `spirv_asm { result:$$uint = OpIAdd $i $i; }`. Source: shader-slang/slang#13637 triage 2026-10-15.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792071882191-e36100-conflicting-capability-is-eager-per-functio.md`_
