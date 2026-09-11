---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789052963494-xtv0u5
written_at: 2026-09-10T16:18:32.036Z
---

# CORRECTION: getCanonicalType() in isRayPayloadStructType (#12994) was a no-op, not a live-bug fix — empirical A/B beat the source trace

**Corrects the earlier learning** "isDeclRefTypeOf takes Val* and does NOT canonicalize — pass getCanonicalType() to see through typealias." That note's *general* facts about the functions are still accurate (see below), but its **conclusion** — that omitting `getCanonicalType()` causes a live divergence for a `typealias`/`typedef` nested `[raypayload]` member (E40000 unqualified / missed E40022 qualified) — was **empirically disproven**.

**What actually happened.** The fixer rebuilt slangc with only `->getCanonicalType()` reverted (commit 67527a0ef's exact helper) and re-ran the alias cases:
- `typealias` **unqualified** → still compiles, emits `NestedPayload_0 nested_0;`, no E40000 (exit 0).
- `typealias` **qualified** → still fires E40022 (exit 255).

So the aliased spelling was **already handled on 67527a0ef**; `getCanonicalType()` is a **no-op / hardening (correct-by-construction)** for these spellings, not a fix for a live bug. The field type reaching `checkRayPayloadStructFields` already resolves to the `StructDecl` even without an explicit canonicalize — the precise source path is unconfirmed (the subagent's `NamedExpressionType`/`CoerceToProperTypeImpl`-preserves-sugar read did not predict the observed behavior; struct-field type checking evidently resolves the alias before this point). A's 🔴 was therefore a **hardening nit, not a live blocker**.

**Still-true low-level facts** (verified, unchanged): `isDeclRefTypeOf<T>` takes `Val*` and its internal `as<DeclRefType>` binds the non-canonicalizing `as<T>(NodeBase*)` overload (slang-ast-type.h:76-84, slang-ast-base.h:76-80), not the canonicalizing `as<T>(Type*)` one (slang-ast-base.h:615-619). What was WRONG was assuming that necessarily makes a typealias struct-field member unrecognized at `checkRayPayloadStructFields`.

**The durable lesson (this is the real takeaway).** A source-derived "this diverges" trace — however many file:line citations it carries — is a **hypothesis** until an empirical fail-before/pass-after A/B on the *exact reviewed commit* confirms it. When multi-phase type/sugar reasoning conflicts with a clean rebuild+run, **trust the rebuild.** Here I over-weighted the static trace and called a hardening nit "load-bearing"; the 2-minute A/B settled it the other way. When adjudicating a reviewer finding vs. a fixer's empirical result, drive to the rebuild A/B rather than escalating source-reading — and label any source-only conclusion as provisional until it is.
