# A unit test green locally and red only in CI is an ambient-env difference, not flake — slang CI exports SLANG_RUN_SPIRV_VALIDATION=1

## The trap

A unit test that passes locally and fails **only** in CI is almost never flake — it's reading ambient
environment your local shell doesn't have. Before you touch anything:

```bash
grep -rn "<SUSPECT_VAR>" .github/workflows/
SUSPECT_VAR=1 ./build/Debug/bin/slang-test slang-unit-test-tool/<yourTest>
```

That's a one-step deterministic local repro instead of a guess.

## slang specifically

**CI exports `SLANG_RUN_SPIRV_VALIDATION=1`** — `ci-slang-test-container.yml:130` and `:203`, plus
`ci-slang-test.yml`, `ci-slang-coverage-test.yml`, `ci-slang-sanitizer.yml`.

So **any unit test that installs a fake `slang-glslang`** via `ISession::setSharedLibraryLoader` must
export `glslang_validateSPIRV`, or every compile against that fake dies before reaching whatever you
were testing. The chain, worth knowing because the failure surfaces far from its cause:

1. `validate` returns failure (`m_validate` is null).
2. `createArtifactFromIR` diagnoses `SpirvValidationFailed` (`slang-emit.cpp:3437-3444`).
3. That diagnostic is declared with `internal(` in `slang-diagnostics.lua`.
4. `Severity::Internal` sorts **above** `Fatal` (`slang-diagnostic-sink.h:13-21`).
5. The sink calls `SLANG_ABORT_COMPILATION` at `slang-diagnostic-sink.cpp:619` — **immediately**, not
   via a later error-count check.

Symptom in my case: a "was the fake compiler invoked" flag was false, i.e. the library loaded but its
compile entry point never ran.

## Fix direction

Make the fake a **complete-enough stand-in** — export an accepting validator. Do *not* reach for
`ScopedEnvVar` to force the variable off: a test should tolerate ambient configuration rather than
mutate process-global state to dodge it. (An independent reviewer endorsed this twice.)

## Two things that cost me the most

1. **Re-run your revert drill under the CI env**, not just the default env. Otherwise you have no
   evidence the fix didn't make the test vacuous. Mine still segfaulted 2 of 6 with the guard removed
   — that's what turned "not vacuous" into a fact.
2. **Two failure routes can share one cause — check your explanation against every failing case.** A
   reviewer proposed "the library precompile validates first"; correct for 2 of my 3 failures, but the
   third test does no precompile and failed anyway (it dies in its own compile, and for it ordering is
   irrelevant since link precedes validation and it skips linking). I only found that by deleting the
   validator export and running that one test alone.

## The real cost

A maintainer had already **approved** the PR when the first non-draft CI run exposed this. Fixing it
**dismissed the approval** (any commit does). Worth an explicit PR comment explaining it was your test's
fault, what is unchanged, and the both-directions evidence.

Related: a "CI is a cosmetic priority-yield" reading has a shelf life — `retry-yielded-bot-ci`
force-runs an aged yielded run, and those jobs really build and test. Discriminate by counting
skipped-vs-run among build/test jobs, not by the trigger event.
