---
name: a-guard-keyed-on-a-diagnostic-that-is-deliberately-never-emitted
description: "TRIGGER: you are writing a guard/skip keyed on an error message or diagnostic code. Verify that signal is EMITTED on the path you care about — a peer's E00100 guard would never have fired because the loader deliberately suppresses the diagnostic (it probes several library names). Key on state, not on a message."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-08, slang #12408 / #12382.** A Windows-only unit-test failure. `slang-fixer` diagnosed it correctly from source, then **wrote a fix that would not have worked, and a probe caught it before shipping.**

Their first fix keyed the skip on the `E00100` *"failed to load downstream compiler"* diagnostic — a reasonable assumption that a failed load is diagnosed. Their probe, using the product's own API to reproduce the missing-module state (`setDownstreamCompilerPath(SLANG_PASS_THROUGH_SPIRV_OPT, "/tmp/emptydir")`):

```
codeResult=0x00000000  producedCode=1  generator=0x00280000 (tool 40)
DIAGS: (empty)                                    ← the signal the guard keyed on
```

✅ **Main-verified the reason at `master=716ec597`, `slang-check.cpp:123-128`, verbatim:**
```cpp
// We want to be able to report a diagnostic to the user if a loader
// was unable to locate the desired downstream compiler, but we
// also need to deal with the fact that the locator might "probe"
// multiple possible library versions/names, and failing to load
// one library should not be taken as a hard error.
```
⇒ **The absence of a diagnostic is a deliberate design choice with an in-source rationale.** A guard keyed on `E00100` is keyed on a signal that *cannot* appear on that path.

⇒ ⭐⭐⭐ **A GUARD KEYED ON A DIAGNOSTIC ASSUMES THE DIAGNOSTIC IS EMITTED — and "this failure surely reports itself" is the assumption least likely to be checked, because it feels like a property of failure rather than a choice someone made.** Key on **state** you can read (here: the SPIR-V generator word — Slang stamps `40 << 16` when it emits a module itself, so tool ≠ 17 *is* the "no link ran" state) rather than on a **message** you hope exists.

⭐⭐ **The shipped guard is the right shape and I verified it at `50d7a5e71f`:**
```cpp
static const uint32_t kSpvGeneratorSlang = 40 << 16;   // mirrors kSPIRVSlangCompilerId
...
if ((outcome.generatorMagic & 0xFFFF0000u) == kSpvGeneratorSlang) { SLANG_IGNORE_TEST; }
```
with an in-source comment explaining why the constant is spelled out (the defining header is private to SPIRV-Tools; the id is a registry allocation) and citing the sibling test that skips on the same dependency. **Mirrors existing precedent instead of inventing a mechanism** — `unit-test-spirv-validation-unavailable.cpp:214-221` does exactly this with `SLANG_E_NOT_AVAILABLE`.

## ⭐⭐⭐ THE NEGATIVE CONTROL IS WHAT MAKES THIS A FIX RATHER THAN A CHANGE

Their 4-cell matrix, reproducing the Windows state on Linux by moving `libslang-glslang-2026.14.1.so` aside (backed up, restored, `cmp` byte-identical):

| module | env | result |
|---|---|---|
| present | unset / `=1` | PASS 1/1 — link runs, tool-17 asserted |
| absent | unset / `=1` | skip, exit 0 |
| **absent, GUARD REMOVED** | — | **EXIT=1, 0/1 passed** ← the Windows failure, reproduced |

⇒ **The guard-removed cell is the whole argument.** Without it, "the test now passes" is compatible with "the test no longer tests anything." ⭐ **A skip is the one fix shape that can silently delete coverage, so a skip needs its negative control more than an ordinary patch does.** And it converted their own honest *"the trigger is inferred from your census"* into a measured trigger.

## ⚠️ The caveat they volunteered, which is the one I'd keep loudest

*"If it's a packaging or staging bug on those runners, the skip converts a red into a silent no-coverage, which is correct behaviour for a test but does not fix the packaging."*

⇒ ⭐⭐⭐ **A correct skip and an unfixed environment produce the same green.** They flagged it rather than letting CI green imply platform coverage — **the honest form of "fixed" here is "the test no longer misreports; the platform is still uncovered."** Why the module fails to load on `windows-*-cl-x86_64-gpu` remains unestablished.

## ⭐⭐ Two supporting findings from the same chain

- **"Absent ≢ green", measured by me on both heads:** `#12382 @f93eb4f74a` → 84 check-runs, 14 windows rows, **0 non-skipped**; `#12408 @7628167136` → **2 real failures** (`test-windows-{debug,release}-cl-x86_64-gpu / test-slang`). File byte-identical on both (7,163 B, md5 `d2849dc4188d2cb5`). **The defect was equally present on both PRs; only one measured it.** The priority gate had skipped every Windows job for two days.
- ⛔ **A reviewer nit declined as "unreachable configuration" was reachable** — reviewer C's C009 flagged the missing skip path, citing the sibling precedent; the fixer judged `SLANG_ENABLE_GLSLANG_SUPPORT=0` unreachable in the unit-test suite. `grep -c 'SLANG_IGNORE_TEST|NOT_AVAILABLE'` on their file → **0**. ⇒ **A nit dismissed as covering an unreachable configuration is exactly the nit to re-check when a platform's results are ABSENT rather than green** — the platform that would have refuted them had every job skipped.
- ✅ **They also fixed the reporting defect that made the triage hard:** the diagnostics `fprintf` was gated on `codeResult != SLANG_OK`, which is *false* on this path — hence empty `stderr`/`stdout` with exit 1. Now prints `codeResult`, `producedCode`, `generator` unconditionally. ⇒ **a failure whose log cannot classify it costs more than the bug**; fixing the reporter alongside the bug is the right instinct.
- ✅ **They declined to push to the sibling's branch** even after I said the drafts-only guardrail was satisfied, preferring a clean cherry-pick: *"I'd rather they apply it than have two sessions writing one branch."* Correct — my authorization removed a policy objection, not the coordination hazard.

## ⛔⭐⭐⭐ THE SECOND GUARD WAS ALSO WRONG — AND THE PEER CREDITED THE CATCH TO ME. IT WAS THEIRS. (2026-08-08 11:38Z)

The shipped generator-id guard (`50d7a5e71f`) had a defect worse than the one it replaced, and **they found it themselves**: it keyed the skip on **the exact symptom the assertion exists to catch.** *"Generator is Slang's own id"* is precisely what a genuine **link regression** looks like — so a real regression would have **silently skipped instead of failing.** ⇒ **a vacuous skip built into the fix for a vacuous-assertion problem.**

⭐⭐⭐ **THE GENERAL RULE, and it is the sharpest thing on this whole chain: A SKIP CONDITION MUST KEY ON THE DEPENDENCY, NEVER ON THE SYMPTOM.** *"Precondition absent"* and *"the thing under test broke"* frequently produce the **same observable**, and keying on that observable deletes exactly the coverage the test exists to provide. The two guards are a matched pair of the same error at different layers: the first keyed on a **message that is never emitted**, the second on a **state indistinguishable from the failure**. ⇒ **Ask of any skip: what does a REGRESSION look like here, and is it distinguishable from my skip condition?**

✅ **The rewrite (`7037262b16`) verified by me:** keys on `globalSession->checkPassThroughSupport(SLANG_PASS_THROUGH_SPIRV_OPT)` (line 53), which routes to `checkExternalCompilerSupport` → `getOrLoadDownstreamCompiler` → `SLANG_E_NOT_FOUND` — **a real load attempt, not a table lookup.** `kSpvGeneratorSlang` is gone from the guard; `if (!outcome.haveSpirvOpt) SLANG_IGNORE_TEST;` at :203-206, with an in-source comment (`:197-202`) stating **why** the symptom-keyed version was rejected and citing the sibling. **The reasoning is in the tree, not just in the report** — which is what makes it survive the next reader.
✅ **Their control is the cell that proves it:** with the module **present** and a link regression injected (`needsLink = false` forced in `slang-emit.cpp`, rebuilt, then restored) → **FAILS, EXIT=1, 0/1.** The old guard would have skipped. **A skip's negative control must include the "precondition present but subject broken" cell, not just "precondition absent".**

⛔⛔ **MISATTRIBUTED CREDIT — measured, and it goes against me.** Their report opens *"your second concern was a real defect"* and credits me with both the symptom-vs-dependency catch **and** an observation about `slang-glslang.dll` being present in the Debug `bin_dir` artifact at log line 2832. **I raised neither.** Transcript search over 8.7 MB, per-role:
```
'2832' · 'bin_dir' · 'keyed the skip' · 'symptom the assertion' ·
'generator is Slang' · 'checkPassThroughSupport'
   → mine = 0 for every one;  inbound = 1 for every one
```
⇒ **Both findings are entirely theirs, including the log-line evidence that weakened their own premise.** ⭐⭐⭐ **A peer attributing their own catch to me is the error class I am LEAST likely to detect, because accepting it is flattering AND requires no work** — the exact mirror of the self-blame case from this same session, where a peer took responsibility for *my* implementation bug. **Both directions of misattribution need the same transcript check, and neither announces itself.** ⇒ **When a report opens by crediting you, grep your own outbound for the claim before accepting it.**

⚠️ **Containment expired, and they flagged it before I could:** the test file is now **three different files** — `#12408 @7628167136` 7,163 B `md5 d2849dc4…`, `#12382 @50d7a5e71f` 8,496 B `md5 32272617…`, `#12382 @7037262b16` 8,766 B `md5 aaf1679f…`. Their earlier *"this lands on both PRs"* rested on byte-identity that no longer holds. ⇒ **#12408 closes both issues and carries NEITHER fix.** ⭐ **An argument resting on two artifacts being identical acquires an expiry date the moment either is touched — state the identity as a precondition, not a property.**

✅ **And they correctly declined to claim green:** a draft push yields only a `pull_request` run, which `ci.yml`'s `filter` gate concludes as skipped ⇒ **this head is unmeasured, not green.** They also declined to manually dispatch, on the correct ground that the retry is blocked by an active run rather than by their cadence.
