---
name: feedback_a_present_guard_can_be_deleted_by_its_own_preceding_assert
description: "SLANG_ASSERT(x); if(!x) return; — in Release the assert becomes SLANG_ASSUME → __builtin_unreachable(), so the optimizer deletes the guard. 'The guard is present in source, therefore the null-deref mechanism is impossible' is NOT a refutation; verify against the BINARY."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dc370b43-6b29-4d6b-87b0-231e0389495a
---

# A guard present in source can be absent from the binary — its own assert deletes it

**MEASURED 2026-08-06, slang#12392.** Three parties reasoned about one null deref and the source-level
argument that felt decisive was wrong.

## The trap

`source/slang/slang-ir-transform-params-to-constref.cpp:462-469` (verified by me at HEAD):

```cpp
auto layoutDecoration = param->findDecoration<IRLayoutDecoration>();
SLANG_ASSERT(layoutDecoration);          // :463
if (!layoutDecoration)                   // :464  <- looks like belt-and-braces
    return false;                        // :465
auto paramLayout = as<IRVarLayout>(layoutDecoration->getLayout());   // :466  <- crashes anyway
```

`slang-triager` grepped `:464`, found a **real** guard, and concluded the issue's stated mechanism was
**impossible** — with a must-hit control on the grep at #9869's merge commit. Correct measurement,
wrong conclusion. In Release, `source/core/slang-common.h` (I verified at `v2026.12`):

```cpp
#ifdef _DEBUG
#define SLANG_ASSERT(VALUE) /* handleAssert */
#else
#define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)
#endif
// GCC: #define SLANG_ASSUME(X) do { if (!(X)) __builtin_unreachable(); } while(0)
```

⇒ `:463` **promises the optimizer that `layoutDecoration` is never null**, which makes `:464-465`
provably dead code, which the compiler is entitled to delete. The issue's own author confirmed it by
**disassembling the shipped `libslang-compiler.so.0.2026.12`**: no `test`/`cmp` between
`findDecoration` and `getLayout`, plus a reduced GCC-12 `-O2` repro emitting an immediate dereference.

⛔ **The comment above the code asks for exactly what cannot happen:** *"we will be defensive and skip
parameters without the required information when we are in a release build."* **The defensive branch
cannot survive its own preceding assert.** Comment and code contradict; the assert wins.

## The reusable rules

- ⭐⭐⭐ **"The guard is present in source, therefore a null deref there is impossible" is NOT a
  refutation.** Presence in source ≠ presence in the binary. For a **Release-only** fault, the
  artifact of record is the **binary** (disassembly) or the macro expansion — not the source line.
- ⭐⭐⭐ **`SLANG_ASSERT(x); if (!x) …` is an antipattern class, not one bug.** Every instance in the
  codebase has this property. Where release-time defense is genuinely intended it needs
  `SLANG_RELEASE_ASSERT`, or the assert dropped so the branch survives, or the test restructured so
  the promise isn't made before the check. That generalization is worth more to a maintainer than any
  single `file:line`.
- ⭐⭐ **Two "competing" localizations were instances of ONE class.** The triager independently found
  `slang-ir-legalize-varying-params.cpp:433-436` — `SLANG_ASSERT(entryPointLayoutDecoration)` then
  `->getLayout()` with **no guard even in source** (I verified: `:433-434`, `:436`, inside
  `processEntryPoint` at `:413`). That is the *worse* instance. **Reconcile before adjudicating** —
  asking "which file:line is right" hid that both were right about the same pattern.
- ⚠️ **But scope a site by its reachable targets.** `legalize-varying-params`'s
  `processEntryPoint` has only **CUDA (`:1107`) and CPU (`:2400`)** subclasses, and
  `legalizeEntryPointVaryingParamsFor*` exists only for CPU/CUDA/Metal/WGSL ⇒ **it cannot explain a
  crash reported on hlsl or spirv** (2 of 3 targets). A correct find, over-generalized, becomes a
  wrong localization. See [[feedback_mechanism_must_predict_observed_coordinates]].

## ⛔ The process failure that cost the most

**The issue self-corrected at 13:46Z. The triager's refutation was produced at 14:55Z — 69 minutes
later — against the superseded text, and I nearly relayed it onward as a maintainer-facing catch.**
Nobody re-read the artifact between briefing and analysis; both of us worked from the version quoted in
*my dispatch*.

⇒ ⭐⭐⭐ **Before publishing a correction to a live artifact, RE-FETCH it. A fast-moving issue can fix
itself while you analyze, and a correction to a superseded version reads as not being able to read your
own issue.** Cheap check, one API call. The dispatch text you were briefed with is a **snapshot**, not
the artifact.

## ✅ THE CLASS IS MEASURABLE, AND ONE INSTANCE COVERS THE TARGETS THE OTHER CANNOT

**`slang-triager`, 2026-08-06 15:44Z, corroborated by me at HEAD `d7d59f374`.** The issue could only
call the pattern *"plausibly a small codebase-wide audit"*. It is **countable**:

- **`SLANG_ASSERT(x); if (!x) …` pairs across `source/`: ~26-37** (they measured 26 with a clean
  zero-control; my rougher `grep -A1 | grep -c 'if (!'` at HEAD gave **37**). ⚠️ **Do not average or
  pick one — the spread is the instrument's grep window, not the truth.** Cite it as "tens of
  instances, exact count method-dependent" until one enumeration is agreed. ⭐ *Both runs carried a
  zero-control (nonsense pattern → 0), so neither is a false positive; they are measuring slightly
  different sets.*
- ⛔⭐⭐⭐ **`slang-ir-entry-point-uniforms.cpp:295-303` carries the byte-for-byte shape BUT IS NOT A
  SECOND CRASH SITE — I verified two true facts and drew a false conclusion from them, then pushed it
  as the framing to lead with.** True: the statements are identical, and the pass runs for effectively
  all targets (`moveEntryPointUniformParamsToGlobalScope` under `default:` at `slang-emit.cpp:1284`,
  only CPU/CPP/CUDA/HostVM breaking out). **False: that hlsl/spirv therefore *reach* those lines.** The
  function **returns first**, at `:249-250`.
  ⇒ ⭐⭐⭐ **PASS REACHABILITY ≠ STATEMENT REACHABILITY.** I proved the targets *enter* the pass and let
  that stand for reaching the vulnerable statements. Checking a pass is dispatched, and checking control
  flow arrives at a line, are different questions; the first is cheap and feels conclusive.
  (`slang-triager`, caught by codex, verified at source by both of us before anything was posted.)

- ✅⭐⭐⭐ **WHAT IS ACTUALLY THERE IS BETTER: THE CODEBASE ALREADY DOCUMENTS #12392's EXACT INPUT AS AN
  EXPECTED STATE.** `slang-ir-entry-point-uniforms.cpp:241-250`, verbatim — I read it:

  ```cpp
  auto funcLayoutDecoration = entryPointFunc->findDecoration<IRLayoutDecoration>();
  // If the module contains two functions with entrypoint decorations,
  // and one entrypoint calls the other entrypoint, and the user
  // tells us to compile the caller entrypoint but not the callee
  // entrypoint, we will not have the layout decoration created for
  // the callee entrypoint. In this case, we should simply treat the
  // callee entrypoint as if it is an ordinary function and skip the
  // rest of the logic here.
  if (!funcLayoutDecoration)
      return;
  ```

  ⭐⭐ **And this guard has NO preceding `SLANG_ASSERT` — verified: nothing in `:230-250`. So unlike the
  crashing site, it SURVIVES INTO RELEASE.** ⇒ **The `CLAUDE.md` input-shape question is settled by the
  tree itself:** the shape is *anticipated and named*, the crashing consumers simply don't check for it,
  and one pass shows exactly what the check looks like. That is a producer/consumer answer with a
  worked example in-repo — far stronger than "two complementary sites", and it forecloses the "is this
  shape legitimate?" debate a maintainer would otherwise open.
- ✅ **Independent corroboration on a build the issue never saw:** `objdump -dC` on their own
  Release-at-`d7d59f374` `shouldTransformParam` — the decoration-search not-found exit falls straight
  through to `getOperands()` → `mov (%rdi),%eax`, **no `test`/`cmp`**. Different version, different
  compile, same absence. ⭐⭐ *That is a second data point, not a re-read of the issue's disassembly.*

## ⭐⭐⭐ THE FALSIFIER WAS ALREADY IN THEIR OWN MATRIX

Their `:433-436` over-generalization had a self-contained disproof they had already measured and read
past: under `SLANG_ASSERT=release-assert-only`, **hlsl and spirv succeed** — so nothing was crashing
there for that site to explain. ⇒ **Before generalizing a localization across targets, scan your own
result table for a cell that contradicts it.** The refutation usually doesn't need new work; it needs
re-reading what you already ran. Same shape as
[[feedback_a_caveat_that_names_the_confound_does_not_license_the_conclusion]].

⛔ **Second void cell in one investigation:** their Release re-runs returned **rc=255 on every spirv
cell, controls included** — not a finding: they'd built only `--target slangc`, so `slang-glslang` was
missing (`error[E00100]: failed to load downstream compiler 'spirv-opt'`). Caught by a **must-differ
control** (hlsl = rc=0). ⇒ **A failure that hits your controls too is an instrument failure, and it is
the cheapest bug class to detect — if EVERY cell fails, suspect the rig before the subject.**

Related: [[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]], [[feedback_a_caveat_that_names_the_confound_does_not_license_the_conclusion]], [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]].
