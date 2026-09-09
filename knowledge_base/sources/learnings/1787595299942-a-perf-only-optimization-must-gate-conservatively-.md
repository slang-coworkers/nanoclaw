---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787146218418-jdhweq
written_at: 2026-08-24T18:14:59.942Z
---

# A perf-only optimization must gate conservatively; provenance proxies relocate the bug

**Context:** shader-slang/slang #12623 — defer user `[ForceInline]` to NVRTC on CUDA (emit `__forceinline__` instead of inlining in-Slang). Two design errors recurred, both worth internalizing.

**1. When one branch of a fork is "always correct, maybe slower" and the other is "faster, sometimes wrong," the gate must be conservative — do the safe thing by default, take the fast path only when provably safe.** Deferring an inline to the downstream compiler (NVRTC) is a PURE performance optimization: inlining in-Slang (`__device__`) is always a legal lowering; deferring (`__forceinline__`) is only ever a preference. So the fix must NOT be "defer by default, veto the cases that break" (whack-a-mole: constexpr-param, setter, synth-accessor, static_assert-helper — each veto found by a new failing test). It must be "inline by default, defer only when provably safe." The failure mode of getting this backwards is a stream of "add another veto entry" fixes, each of which is a proxy for the real property.

**2. A provenance/context proxy that CORRELATES with the target property doesn't CLOSE the bug class — it relocates it.** The fixer's chain of discriminators were all coincidental correlates of "this func must inline in-Slang for correctness":
- `loc`-validity (proxy for "user-authored") — defeated because synthesized AST nodes inherit locs.
- `!SetterDecl && !hasConstExprParam` (enumerated exclusion) — defeated by a THIRD synthesis site (`create<ForceInlineAttribute>` on a synth accessor) the enumeration missed.
- `!isFromCoreModule` (proxy for "compiler machinery") — defeated by the SYMMETRIC hole: a *user* `static_assert(myForceInlineHelper(K))` is `isFromCoreModule==false` → deferred → same compile error, now in user space. Module-membership merely correlates with "is required-inlined by a pre-emit consumer" because that machinery mostly lives in the core module today.
The tell: each fix made the current failing test pass while leaving the *general* property unexpressed. **Test for it by asking "what's the actual property, and does this predicate equal it or merely correlate?" then construct the case where they diverge** (here: user-space static_assert). If you can build that case, it's a proxy.

**3. The real invariant for "must not defer/optimize-away" is usually a REACHABILITY property, enforced at the consumer's requirement, not a provenance flag at the producer.** Here: "a func transitively called from a constant-required context (a `static_assert` condition, a constexpr fold, an array-size expr) must be inlined before that consumer runs." Slang has NO compile-time call interpreter (`checkStaticAssert` at slang-emit.cpp:654 is a pure checker — reads operand(0), demands it's already an `IRBoolLit`, else E41402; the fold happens only via inline@:1706 → simplifyIR@:1728 → check@:1993). So the constant only materializes by inlining. Express the invariant as "don't defer funcs reachable from constant-required contexts," or sidestep it: if the perf win comes from the emit-time `__forceinline__` hint rather than from NOT inlining in-Slang, don't suppress the in-Slang inline at all — let it inline for the passes that need it and emit the hint only for funcs that survive to emit. Always ask which mechanism actually delivers the win before building suppression machinery.

Companion to [[a-single-user-producer-census-does-not-clear-a-per-origin-gate]] and [[a-replace-refactor-s-edit-set-is-filtered-readers-copiers-only]].
