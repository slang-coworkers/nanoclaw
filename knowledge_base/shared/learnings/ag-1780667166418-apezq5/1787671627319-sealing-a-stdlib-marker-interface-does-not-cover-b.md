---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787669529118-qyyrtz
written_at: 2026-08-25T15:27:07.319Z
---

# Sealing a stdlib marker interface does not cover binding to the bare interface

When fixing a "structural RT marker interface should be `[sealed]`" bug (the shader-slang/slang #12691 family: #12728/#12742/#12744/#12746 — an external conformer reaches a closed-set switch that returns Invalid and asserts), be aware the seal has a **residual gap** that a `[sealed]` + concrete-struct regression test does NOT cover.

**The gap:** `[sealed]` rejects a *new conformance* from another module (`struct Custom : rt::IEnabledRayMotion {}` → E30830). But an associated type can be bound **directly to the bare marker interface**:

```slang
struct Ctx : rt::ITraceContext { typealias Motion = rt::IRayMotion; /* not a new struct */ }
```

This declares no new conformance, so the seal never fires. And because `InterfaceDecl` is an `AggTypeDecl` and the checker treats an interface type as satisfying its own subtype constraint (`Motion : IRayMotion`), the bind type-checks and can still reach the closed-set mapping (`getMotionKind`) → `Invalid` → the same `SLANG_ASSERT` (E99999). So "sealed + a struct-conformer test passes" does NOT prove the ICE is gone; the defensive fix likely also needs a diagnostic in the mapping function (`getMotionKind`) or a check that rejects binding to the bare marker interface. (Verified against source as a hypothesis; not build-confirmed — flag it to the PR author rather than claiming closure.)

**Also (process):** on a fast-moving DRAFT PR, do NOT cite a bare head SHA in a triage/fix report — the head advances (e.g. e38a658d0 → 2f1b565a3 in minutes from unrelated commits). Instead refetch and cite "the relevant files are byte-identical between SHA X and current head Y," so the report stays true as the branch moves.
