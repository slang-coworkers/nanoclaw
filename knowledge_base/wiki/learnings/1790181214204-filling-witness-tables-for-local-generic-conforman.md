---
title: "Filling witness tables for local generic conformances also tightens non-conformance diagnostics (E38100) — downstream break risk"
type: learning
topic: slang-compiler
source: learnings/1790181214204-filling-witness-tables-for-local-generic-conforman.md
---

# Filling witness tables for local generic conformances also tightens non-conformance diagnostics (E38100) — downstream break risk

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789484447769-n7for2
written_at: 2026-09-23T16:33:34.204Z
---

# Filling witness tables for local generic conformances also tightens non-conformance diagnostics (E38100) — downstream break risk

When fixing a "read-before-checked" crash by driving a function-local generic type to
`ReadyForConformances` eagerly (slang#13092: `visitBlockStmt` now drives local `GenericDecl`s whose
inner is an `AggTypeDeclBase` through `ensureAllDeclsRec`), the fix has a **wider behavioral
footprint than "stop the crash"**: it also makes the compiler **eagerly reject non-conforming local
generics**.

Verified on both builds with a declared-but-**unused** `struct Bad<V> : IOp { V val; }` (missing
`apply`):
- Unfixed: compiles clean (exit 0) — the local generic's conformance was never checked.
- Fixed: `error[E38100]: missing interface member` at the declaration.

This is **principled and consistent**: a MODULE-SCOPE non-conforming generic already errors E38100 on
unfixed (even unused) — local generics were the inconsistent gap (same bug as the crash). So the
tightening aligns local scope with module scope; it is not an arbitrary new rule.

**But** it can break downstream integration builds (e.g. Falcor CI) that contain a *latent*
non-conforming local generic previously accepted only because of the bug. slang#13095's `test-falcor`
check failed on the merged head while `test-falcor` was green on master — a strong candidate is my
fix surfacing such a latent E38100 in Falcor's shaders (the correct resolution then is to fix the
Falcor shader, not weaken the compiler fix). Could not confirm directly — the Falcor pipeline is
NVIDIA-internal/external and its error is not in the GitHub `run-external-ci` logs (which only report
"pipeline finished with status 'failed'").

Takeaways for this fix-class:
1. When a fix moves a type into eager conformance checking, always test the **declared-but-unused
   non-conforming** case on both builds — it reveals the diagnostic-tightening footprint.
2. Call this footprint out in the PR body / to the maintainer; it may surface latent errors in
   downstream integration tests even though the change is correct.
3. External integration checks (Falcor) fail opaquely in GitHub logs — you cannot self-diagnose;
   escalate to the maintainer who has the external-pipeline log.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790181214204-filling-witness-tables-for-local-generic-conforman.md`_
