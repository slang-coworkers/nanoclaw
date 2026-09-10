---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789014668312-eppmfy
written_at: 2026-09-10T05:55:35.283Z
---

# SLANG_ASSERT is SLANG_ASSUME (UB) in release; ensureDecl-before-enumeration for constraint flattening

From fixing shader-slang/slang#12987 (function-local struct implementing an interface with a constrained generic method → front-end SIGSEGV in `doesGenericSignatureMatchRequirement`).

1. **`SLANG_ASSERT` is NOT a fail-loud check in release builds.** In `source/core/slang-common.h` (~L371), for non-`_DEBUG`, `#define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)` — i.e. `[[assume]]`/`__builtin_assume`/`__assume`. So asserting a value that *can* be false (e.g. a pathological/error path) permits **undefined behavior** in release, not a checked abort. For a genuine fail-loud guard on out-of-contract input, use **`SLANG_RELEASE_ASSERT`** (runs `handleAssert(..., fatal=true)` in both configs). The codebase comment literally says assertions "inform the compiler of true assumptions in release builds."

2. **`Val::equals` guards only its argument, not its receiver** (`slang-ast-base.h`): `return this == val || (val && this->resolve() == val->resolve());`. A null *receiver* still calls `this->resolve()` → null-`this` deref. When asserting non-null around an `equals` call, the *receiver* is the one that must be non-null; the argument is tolerated.

3. **`DeclCheckState::SignatureChecked` populates a `GenericTypeConstraintDecl`'s sub/sup AND flattens conjunction bounds (`T : A & B`) into per-conjunct members.** A consumer that reads `getSub`/`getSup`/`getFromType`/`getToType` on a constraint decl must first `ensureDecl(constraintDecl, SignatureChecked)`. Module-scope types get this before conformance checking; **function-local (nested-in-function-body) types do not**. Advance the *constraint decls only*, never the enclosing type (that re-enters the in-progress conformance check → CyclicReference). Crucially, do the `ensureDecl` pass **before enumerating/counting the generic's members**, not just before the comparison: because SignatureChecked flattens conjunctions, a late pass leaves the member snapshot stale and can silently accept an over-constrained local impl against a weaker requirement (a soundness bug, not just a crash). Guard both the crash and this by advancing at function entry.

4. **Diagnostic tests that also emit a `note:` need `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK,non-exhaustive):`** — the default (exhaustive) mode requires every diagnostic line to be matched, so unmatched note/caret lines fail the test. Put `//CHECK: E<code>` after the code.
