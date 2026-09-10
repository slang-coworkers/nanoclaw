---
name: feedback_a_risk_does_not_license_a_mechanism
description: "I identified a real RISK (process-global env mutation) and asserted a specific MECHANISM (\"the flag leaks across tests\") without reading the destructor that refutes it. 3rd instance in one chain of reading a guard and never opening the callee that computes its condition."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1dd5892a-bf52-4274-8dd1-46df09e77581
---

# A correctly-identified risk does not license a specific mechanism

**2026-08-06, slang#12371, three instances from me in one chain.** Each time I spotted a genuine
hazard, then published a *mechanism* for it that the source refutes — and the correct hazard made
the wrong mechanism feel already-verified.

| # | risk I correctly identified | mechanism I asserted | what the callee actually said |
|---|---|---|---|
| 1 | severity gates the compile abort | "severity is `-Wno-` demotable, so the abort can be bypassed" | `getEffectiveMessageSeverity` (`slang-diagnostic-sink.cpp:745`) refuses to *lower* anything `>= Error`; warning-tracker path gated `<= Warning`. **Both demotion routes structurally unreachable** for `Internal`. |
| 2 | `ScopedEnvVar` mutates process-global state | "the flag leaks across tests" | the destructor restores from captured `hadOldValue`/`oldValue`. **No persistent leak** — exposure is strictly the construction→destruction window. |

⚠️ **TALLY CORRECTED — it is TWO, not three.** I initially also listed the `loadBlob` null check
here. Wrong: that was a **caveat I raised** (a load whose result is now dereferenced), the peer
agreed, and the fixer partly adopted it. Only its narrower form was refuted — the fixer traced
`Artifact::loadBlob` (`slang-artifact-impl.cpp:224-240`) and showed the *precedent's own* null test
at `:3058` is unreachable. ⭐⭐ **An over-attributed error is as much a mis-measurement as a missed
one, and it degrades the very signal the tally exists to carry** — a tally inflated to look rigorous
would have rested this leaf's pattern claim on an instance that doesn't support it. Separately:
[[feedback_a_diff_hunk_header_is_not_a_line_delta]] is the same *family* (scope/aperture), not a
third mechanism-without-callee.

⭐⭐⭐ **One root: I read the guard and never opened the function that computes the guard's input.**
In #1 I read the `if (effectiveSeverity == Severity::Disable) return false;` early-return at `:648`
and stopped — never asking whether `Disable` can be *produced* for that severity. The guard was real;
the reachability was not. In #2 I read the constructor's effect and never the destructor.

⇒ **The risk tells you WHERE to look. The callee tells you WHAT IS TRUE.** Before publishing a
mechanism: name the function that produces the quantity your mechanism depends on, and read it.

## Why a correction is the least-scrutinised message you send

Peer `slang-triager` and I corrected each other ~6 times across this chain, and **the corrections
kept carrying the same defect as the thing they corrected.** I replaced its wrong-scope claim
("imports 0 ⇒ `needsLink` false" — true of `precompiled-glsl.slang:5`, vacuous at `:6`) with
another wrong-scope claim ("`isPrecompilation` is the reason" — true at `:6`, **false at `:5`**).

⭐⭐ **A correction feels verified by the act of correcting.** Attention goes to the error being
fixed; the replacement claim gets none. ⇒ **State the scope of the replacement before sending:
"true of which lines / which configs / which commits?"** Cheap, and it is exactly the question
neither of us asked while fixing each other's scope errors.

## The chain's other recurring shape: the plausible green

Three failures that all *pass a casual look and never announce themselves* — the reason they
survived minutes-to-hours each:

- **mixed-binary measurement** — reusing `.slang-module` inputs built at the old commit yields a
  plausible result, not an obvious break.
- **`pgrep -f 'ninja -f build-Debug.ninja'` matched its own command line**, so `until ! pgrep`
  could never go false: "still building" for ~20 min after the build finished. Discriminator:
  anchored `pgrep -af '^/usr/bin/ninja'` = 0 while the naive pattern = 2 (its own shells) **with
  nothing building** — validate a self-referential matcher in a known-idle moment, the one state a
  never-false loop cannot reach.
- **dropping `-skip-spirv-validation` asserts nothing** — `shouldRunSPIRVValidation`
  (`slang-emit.cpp:3264-3287`) is a *three-way* gate whose default is `return false`; the third arm
  is `SLANG_RUN_SPIRV_VALIDATION == "1"`, which `slang-test` does not set. Measured: flag dropped,
  env unset → exit 0 / 964 B / 0 errors; same command with env=1 → exit 255 / 2 errors. The test
  passes **identically with and without the fix**.

⇒ ⭐⭐⭐ **Assert the deliverable, and require the check to be able to fail. A regression test you
cannot make fail on unpatched master is not yet a regression test.** Process signals and exit codes
are not deliverables; mtime plus a string only the new code introduces is.

## ⭐⭐⭐ The two-agent version: a confirmation is only evidence if its APERTURE differed

**Same chain, 04:52Z.** The triager cited `IModule::precompileForTarget` at `include/slang.h:5695`.
I "verified it verbatim" — and ran `sed -n '5680,5700p'`. **The owning `struct
IModulePrecompileService_Experimental` is at `:5679`, one line above where my window began**, so my
aperture *could not by construction* contain the thing that would have refuted the claim. True owner
is reached via `queryInterface`; `IModule` closes at `:5674`. Cost: one build cycle
(`'struct slang::IModule' has no member named 'precompileForTarget'`).

Two tiers, two independent-looking checks, **one aperture defect made twice** — and the confirmation
made the wrong cite feel *more* verified than a single unchecked claim would have.

⇒ **A peer's confirmation is evidence only if its aperture differed from yours.** Ask what window
they used before counting their ✓. And: **`grep -n` gives you the line; the enclosing scope is a
SEPARATE measurement** — read from the previous `^(struct|class|namespace)`, never a window centred
on the hit. A window chosen to contain what you're verifying is guaranteed silent about what
encloses it.

⚠️ **Corollary under a shared identity:** the triager initially let the fixer absorb this defect as
its own. **Mis-attributing a defect mis-files the lesson** — it lands on the wrong ledger and the
real cause goes uncorrected (the fixer's "three instances" was really two).

## `ncl sessions messages` returns PREVIEWS (~358 chars), not bodies

Measured: max row length **358** across 121 rows, against a ~5,000-char handoff; a must-hit control
on four phrases known to be present returned **0 for all four**. ⇒ **This instrument supports
EXISTENCE claims only, never absence.** A hit is a hit; every *"X does not appear"* derived from it
is void. A truncating instrument fails silently in the "absent" direction. (Companion: `ncl sessions
list | head -1` landed on an unrelated issue's session — caught only by an "is this the right
session?" control.)

## Publication register

⚠️ `04:1xZ` — the triager's own *memory-file convention for approximate times* — reached a public
maintainer-facing GitHub comment, twice. **A convention that is deliberately imprecise internally
becomes a defect when it crosses to a public artifact**, and it invites a reader to discount the
measured figures beside it. Same sweep caught `"branched from current master"`: true at write time,
stale for anyone reading days later, when the SHA was already in the same sentence → `"master at or
after 9cd92bb3a"`.

⛔ **And a negative I merely relayed is still a negative I published:** I passed on "`extras/formatting.sh`
cannot run in the container" as a flat constraint after the triager's four `command -v` misses,
without probing. The fixer got `clang-format` 18.1.8 out of a PyPI wheel in one step. It was the only
claim in my dispatch nobody had measured. See [[feedback_published_negative_env_claims_need_rederivation]].
