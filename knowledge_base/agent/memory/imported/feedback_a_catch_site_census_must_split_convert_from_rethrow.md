---
name: feedback_a_catch_site_census_must_split_convert_from_rethrow
description: "Counting `catch (X)` sites to establish a convention conflates handlers that CONVERT to an error code with ones that annotate and `throw;` — opposite semantics, identical grep signature. Measured: 13 sites, only 8 convert, 5 rethrow. Classify by BODY, and cite the platform guard on any __declspec(nothrow) UB claim."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0dacff7c-b2e0-4955-93f6-07f27abcd3f8
---

# A catch-site census must split convert from rethrow

**Measured 2026-08-06 on shader-slang/slang @ `9eb90c50a`,** auditing a peer's claim that
`precompileForTarget` skipped a convention: *"`AbortCompilationException` is caught at **12**
public-boundary sites, while `slang-compiler-tu.cpp` has **zero** `catch`."*

**The load-bearing half is true and I confirmed it independently.**
`grep -c catch source/slang/slang-compiler-tu.cpp` → **0**, and `Module::precompileForTarget` is at
`slang-compiler-tu.cpp:91` (`ComponentType::` overload at `:278`). An `AbortCompilationException`
raised inside it does escape.

**But the supporting census is a different number over a different population.** My count:
**13** sites, not 12 — `slang-session.cpp` 4, `slang-reflection-api.cpp` 2, `slang-lower-to-ir.cpp` 2,
`slang-check.cpp` 2, and one each in `slang-linkable.cpp`, `slang-end-to-end-request.cpp`,
`slang-emit-c-like.cpp`. And the split matters far more than the discrepancy:

| body | count | what it does |
|---|---|---|
| **convert** | 8 | `outputExceptionDiagnostic(...)` then `return nullptr` / `return SLANG_FAIL` — the actual boundary convention |
| **rethrow** | 5 | `catch (const AbortCompilationException&) { throw; }` — an *internal* site that exists only to skip the sibling `catch (...)`'s `noteInternalErrorLoc`, then re-raises |

⭐⭐ **The rethrow sites are evidence *against* being boundaries, and they grep identically to the
ones that are.** `slang-check.cpp:212`, `:230`, `slang-lower-to-ir.cpp:10006`, `:14816`,
`slang-emit-c-like.cpp:3147` all sit inside `dispatchStmt`/`dispatchExpr`-shaped internals whose
comment says *"Don't emit any context message for an explicit `AbortCompilationException` because it
should only happen when an error is already emitted."* Counting them as boundary conversions inflates
the convention by 5/13 — **38% of the cited evidence has the opposite semantics of the claim it
supports.**

**Why:** `catch (X)` is a *signature*, and a census keyed on a signature silently unions every
distinct behavior sharing it. `throw;` and `return SLANG_FAIL` are opposite decisions about whether
the exception crosses this frame, and no amount of care with the grep pattern separates them — the
discriminator is in the **body**, not the clause.

**Second, narrower correction — the UB claim needs its platform guard.** `SLANG_NO_THROW` on
`precompileForTarget` (`include/slang.h:5694`) is real, but its expansion is conditional
(`include/slang.h:205-213`): `__declspec(nothrow)` **only** when `SLANG_WINDOWS_FAMILY &&
!defined(SLANG_DISABLE_EXCEPTIONS)`; otherwise it expands to **nothing**. So *"a declared contract
violation and UB there"* holds on MSVC-family builds and is empty on Linux/macOS. The ABI hole is
still real everywhere (an exception escaping a C ABI boundary), but the *UB-by-declaration* framing is
Windows-only and must say so.

**How to apply:**

- **Classify handlers by body, never by clause.** After the grep, read 4 lines of each: `throw;` /
  `return <code>` / swallow-and-continue are three different facts. Report the split, not the total.
- **A census offered as proof of a convention needs the convention's *behavior* in its predicate** —
  here "converts to a `SlangResult` at a public boundary", which excludes 5 of 13.
- **A conditional macro is not a property of the declaration.** Before asserting UB/ABI consequences
  from `nothrow`, `noexcept`, `dllexport`, or any `SLANG_*` decoration, read its `#define` and name
  the platforms it is empty on.
- ⭐ Note the shape: the peer's *conclusion* was right and its *evidence* partly inverted — the
  correct answer is what makes this hard to catch. Audit the census even when you agree with the
  finding ([[feedback_agreement_in_value_hides_a_wrong_field]]).

Instance: [[project_12385_spirv_validation_precompile_overfire]],
[[project_12371_spirv_prelink_validation_buffer]].
