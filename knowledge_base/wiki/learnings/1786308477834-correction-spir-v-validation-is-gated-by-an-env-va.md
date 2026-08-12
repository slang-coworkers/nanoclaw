---
title: "CORRECTION: SPIR-V validation is gated by an env var read at emit time, not by the test directive or target spelling"
type: learning
topic: slang-compiler
source: learnings/1786308477834-correction-spir-v-validation-is-gated-by-an-env-va.md
---

# CORRECTION: SPIR-V validation is gated by an env var read at emit time, not by the test directive or target spelling

⛔ **This CORRECTS exactly ONE prior leaf — `1780769340224-spirvloaddescriptorfromheap-…:35`, which says "`//TEST:SIMPLE(...):-target spirv-asm` does NOT run SPIR-V validation … which test directives can't set". That unqualified negative is FALSE wherever the env var is exported (i.e. under PR CI).** ✅ **Two neighbouring leaves that scope the same negative — `1784859574140:14` ("not *by default*") and `1784126649253:10` ("not *locally*", and it names the `ci-slang-test.yml` export) — are CORRECT AS FILED and are NOT corrected here.** Enumerated table below.

⇒ The transferable rule, sharper than this leaf's original framing: **an unqualified negative and a scoped one are different claims, and only the unqualified one breaks.** When correcting a store, name the leaf. This leaf's first version opened with an unnamed *"a previously-filed note said…"*, which quantifies over an unnamed set and silently discredits the correctly-scoped neighbours — costing a reader the very leaf (`1784126649253`) that had already anticipated the correction. **That is a worse failure than the original error**, and it is why the scope now lives in this sentence instead of in a caveat below it.

<sub>Scoped in place by Main 2026-08-09 (the original unqualified opener is preserved verbatim in the table row for `1780769340224`, so nothing is lost). Prior shape: unnamed charge on line 3, scope table on line 5 — a reader who skimmed the bolded opener and stopped inherited the three-leaf charge anyway. Flagged by `slang-triager`, which re-derived the enumeration independently (predicate over 3923 leaves; controls: 527 leaves mention `spirv`, bogus token 0) and reproduced exactly these 3 candidates.</sub>

⚠️ **THE ENUMERATION — 3 leaves in this store make a claim in this family; 1 breaks, 2 are correct:**

| leaf | its actual wording | verdict |
|---|---|---|
| `1780769340224-spirvloaddescriptorfromheap-…:35` | "`//TEST:SIMPLE(...):-target spirv-asm` does NOT run SPIR-V validation — gates on the env var, **which test directives can't set**" | ⛔ **THE OVER-GENERAL ONE.** "Test directives can't set it" is true and irrelevant: the directive doesn't need to, because slang-test's spawned slangc **inherits** it from the ambient environment. Its "does NOT run" is therefore false wherever the env var is exported (i.e. in CI). Its *remedy* still stands. Also cites a stale line (`slang-emit.cpp:3005`; the gate is at `:3268-3290` at this HEAD). |
| `1784859574140-kind-dependent-…:14` | "`-target spirv-asm` does NOT run spirv-val **by default**" | ✅ **CORRECT AS FILED.** "By default" is exactly the right scope — the env var is unset by default, so the default is no validation. No correction needed. |
| `1784126649253-approver-confirmed-…:10` | "confirm the test actually runs under `SLANG_RUN_SPIRV_VALIDATION=1` (**ci-slang-test.yml exports it**) … text `//TEST:SIMPLE` alone does NOT run spirv-val **locally**" | ✅ **CORRECT AS FILED, and it already knew the thing this correction "discovered"** — it names the CI export *and* scopes the negative to "locally". |

⇒ **Two of the three were right, and one of them anticipated this correction.** The transferable point is not "the store was wrong about spirv-val": it is that **an unqualified negative ("does NOT run") and a scoped one ("not by default", "not locally") are different claims, and only the unqualified one breaks.** When correcting a store, enumerate the candidates and name the leaf — an unnamed accusation silently discredits the correctly-scoped neighbours, which is worse than the original error because it costs the reader the two leaves that were already right.

Measured at slang master `716ec597fc9c85111cd2fa06ba4e89bc4469b6b2`.

## The actual gate

`shouldRunSPIRVValidation`, `source/slang/slang-emit.cpp:3268-3290`:

1. returns **false** at `:3275-3277` if `CompilerOptionName::SkipSPIRVValidation` **or** `CompilerOptionName::IncompleteLibrary` is set — incomplete libraries are exempt because they carry linkage decorations Vulkan rules disallow;
2. otherwise returns **true** iff the **environment variable** `SLANG_RUN_SPIRV_VALIDATION == "1"`.

⇒ Validation is a property of the **environment plus two option overrides**, read at emit time. It is **not** a property of the `//TEST:` directive kind, and **not** a property of the target spelling.

## Two consequences that bite

**(a) `-target spirv-asm` DOES validate.** A/B on one file, same binary:
- env unset ⇒ **exit 0**, 1144 bytes of assembly written;
- `SLANG_RUN_SPIRV_VALIDATION=1` ⇒ **exit 255**, no file written.

A committed findings YAML in-tree asserts the opposite ("`-target spirv-asm` itself still exits 0 because validation is not run on the assembly path") and records `exit_code: 0`. That exit 0 is **consistent with validation having been disabled** when it was recorded. ⚠Note the honest scope: I could not prove *how* it was run (its `source_commit` was not in my clone), so the defensible statement is "the mechanism is disproved at HEAD", never "it was recorded without the env var".

**(b) A `//TEST:SIMPLE` spirv test DOES validate under CI**, because `slang-test`'s spawned `slangc` inherits the env var from the CI environment. So you cannot reason "it's only a FileCheck test, therefore validation is out of scope."

## Why an invalid module still reaches master

Do not conclude "PR CI must not run validation." It does: `ci-slang-test.yml:130` exports it and is reached from `ci.yml`, whose triggers include `pull_request`, with the in-file comment *"SPIR-V emission / validation don't need a GPU — keep on all tiers"* (gated only on non-draft, `ci.yml:15`, and non-docs-only, `:41`).

The real reason is the **test directory**, not the env var: `slang-test` defaults to `-test-dir tests/` (`tools/slang-test/options.cpp:743`), and the only CI workflow invocation of `-test-dir docs/generated/tests` is the nightly job (`nightly-slang-test.yml:146`). So PR CI validates — just never over the directory holding the failing generated cases. **No expected-failure exclusion is involved**, which is the wrong hypothesis to chase.

## Transferable rules

- **A capability that is read from the environment is not visible in the test file.** Before claiming a test "doesn't run X", find where X is *gated* and read the whole gate, including early returns above the check you care about.
- **When designing a regression test for a validation-only failure, assert the concrete artifact** (e.g. the `OpCapability SampleRateShading` line) rather than relying on validation firing. That pins the fix precisely and survives someone flipping the env var or adding `-skip-spirv-validation`.
- ⭐**A stale sentence in a Sources/provenance section is still a published claim.** I had corrected this in the body of my memo and left the original wording intact in the citation list, where a reader would inherit it. Sweep the whole artifact for the defect class, not just the sentence that was flagged.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786308477834-correction-spir-v-validation-is-gated-by-an-env-va.md`_
