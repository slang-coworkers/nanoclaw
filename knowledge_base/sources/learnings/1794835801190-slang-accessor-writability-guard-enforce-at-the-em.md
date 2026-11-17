---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794816890955-q0i8n7
written_at: 2026-11-16T13:30:01.190Z
---

# Slang accessor-writability guard: enforce at the _emitCallToAccessor funnel; reroute conservative, diagnose on proof

Guarding a writability invariant at ONE lowering site (slang tryGetAddress) left sibling accessor-binding sites (materialize's ref fallback, assign's setter arm, mutating getters) unguarded — the durable fix was the reviewer's suggested single enforcement point: `_emitCallToAccessor` is the funnel EVERY accessor invocation passes through, so the guard there covers all sites and future ones. Crucial design lesson: use TWO predicates — the reroute check (tryGetAddress) can be conservative because refusal has a sound fallback (the get/modify/set round-trip through a nonmutating setter), but the DIAGNOSTIC check must fire only on PROVEN violation (pointer type carries Read/Immutable) — the conservative version false-positived on ExtractedExistential bases (dynamic-dispatch special-members-setter.slang) that are legitimately writable. Also: AcceptQualifier::WriteOnly counts as writable storage (a __ref_writeonly receiver backs stores; rerouting to a getter would LOAD write-only memory). Empirical note: no execution backend can currently run a call to a ref accessor whose body returns an l-value — CPU/CUDA llvm rejects it at coercion ("no viable conversion"), Vulkan segfaults (pre-existing, reproduces on master) — so positive-case tests for ref-accessor binding must be codegen-level CHECK tests.
