---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788393673530-9jau00
written_at: 2026-09-03T00:10:33.351Z
---

# Slang: `foo-&gt;Bar&lt;T&gt;()` 30101 is a non-idempotent member-expr double-check (issue #9810)

**Symptom:** `foo->Bar<42>()` (generic member method called through a pointer `Foo*`) fails with `error 30101: cannot dereference type 'Foo'`, while `foo->Bar(42)` (non-generic) and `foo.Bar<42>()` (dot) both compile. Issue shader-slang/slang#9810; community fix PR #12892.

**Root cause (non-obvious — it's a *double-check* corruption, not a parse bug):**
- `->` builds a `DerefMemberExpr`; on seeing `<`, the parser calls `tryParseGenericApp` (slang-parser.cpp:2951) which runs `CheckTerm(base)` to classify generic-ness — but ONLY when a live semantics visitor is present, i.e. during **deferred function-body parsing**.
- `visitMemberExpr` MUTATES the node in place: `expr->baseExpression = checkBaseForMemberExpr(...)` (slang-check-expr.cpp:8926) rewrites the pointer base into its *dereferenced* form (type `Foo`, not `Foo*`) and returns a **fresh** node (`createLookupResultExpr`).
- `CheckTerm`'s cache guard `if(term->checked) return term;` (slang-check-expr.cpp:2237/2243) marks `checked` on the **returned** node, NEVER on the input `DerefMemberExpr`. So the member node stays `checked==false` with its base already dereferenced.
- The `baseKind==Generic` branch wraps that raw, mutated node in a `GenericAppExpr`; `visitGenericAppExpr` re-runs `CheckTerm` on it (slang-check-overload.cpp:3881) → `visitMemberExpr` runs a **second** time; base is now non-pointer `Foo` → `!needDeref && DerefMemberExpr && !PtrType` → spurious 30101 (slang-check-expr.cpp:8929-8936).
- Working cases confirm it: `foo->Bar(42)` has no `<` (checked once); `foo.Bar<42>()` double-checks too but a plain-value base needs no deref (mutation is a no-op) and 30101 is gated on `DerefMemberExpr`.

**Fix taxonomy:** PR #12892 wraps `checkedBase` (already `checked==true`) instead of the raw node, so the re-check short-circuits. Right direction / low-risk (reuses the canonical checked value) but it SIDESTEPS the latent hazard: member-expr checking mutates its input in place and `CheckTerm`'s checked-guard is ineffective for member nodes (checked result is a different object). Any path that re-checks an already-checked `MemberExpr`/`DerefMemberExpr` can hit the same corruption. True root-cause fix = make member-expr checking idempotent (mark the member node checked / don't re-dereference an already-lowered base / guard the 30101 diagnostic).

**Triage lesson:** when a construct fails only in ONE combination (arrow+generic) while its neighbors (arrow-alone, dot+generic) pass, suspect a **re-entrancy / double-check / cached-state** interaction, not the surface syntax. The three-cell control matrix (with/without generic × arrow/dot) localized the mechanism precisely.
