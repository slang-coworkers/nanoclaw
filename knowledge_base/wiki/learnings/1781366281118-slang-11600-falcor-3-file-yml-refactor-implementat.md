---
title: "slang 11600 falcor 3-file YML refactor implementation gotchas"
type: learning
topic: slang-compiler
source: learnings/1781366281118-slang-11600-falcor-3-file-yml-refactor-implementat.md
---

# slang 11600 falcor 3-file YML refactor implementation gotchas

Implemented the slang#11600 falcor YML 3-file refactor (falcor.yml dispatcher + falcor-slang-build.yml + falcor-slang-test.yml, deleting falcor-test.yml + falcor-compiler-perf-test.yml). Patch handoff (bot can't push .github/workflows/*). HEAD master@530eeb707. Non-obvious bits beyond the triage design:

- **Per-test-type artifact download path is the real implementation gotcha.** The two old falcor tests download the slang bin to DIFFERENT paths: the perf test downloads to `build/Release/bin` (then puts `.\build\Release\bin` on PATH for falcor_perftest.exe), the functional test downloads to `slang-bin` (then copies into the Falcor build tree). In the one parameterized reusable, template it: `path: ${{ inputs.test-type == 'perf' && 'build/Release/bin' || 'slang-bin' }}`. Get this wrong and the bin lands where the test can't find it.

- **The aggregator must NOT copy ci.yml's materialx PR-only guard.** ci.yml's `test-materialx-windows-release` carries `&& github.event_name == 'pull_request'` (PR-only) and relies on check-ci treating skipped==OK in the merge queue. A REQUIRED falcor check is the opposite: `test-falcor`/`test-falcor-perf` must run in `merge_group` too, so they get only `if: needs.filter.outputs.should-run == 'true'` (no PR-only clause). Adding the merge_group trigger to the dispatcher is mandatory or branch protection deadlocks the queue.

- **check-falcor job: set NO `name:`** so its status-check context == the job key `check-falcor` (kebab) — exactly the string branch protection matches. A `name:` would shadow the key and break the required-check name.

- **Shared build = functional/restrictive flags (Decision 1A), unprovable locally.** Build uses falcor-test.yml's flags (GFX=0/TESTS=0/EXAMPLES=0/DAWN/TINT off/RHI=0); the perf exe only needs core slang runtime DLLs + slangc, which the restrictive build still produces. Cannot validate without the self-hosted `perf` runner → disclosed as a CI-only gate with the perf-superset flags as documented fallback.

- **Verification toolchain that worked headless:** actionlint downloads as a self-contained binary via `curl -sSfL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash | bash` (got 1.7.12, validates GHA schema + the `&&/||` ternary + fromJSON expressions; exit 0). shellcheck is NOT installed so actionlint skips shell linting — fine when bash is verbatim from ci.yml's filter. prettier (3.8.4, the repo's YAML formatter via formatting.sh) `--check` confirms YAML style. All three new files: clean.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781366281118-slang-11600-falcor-3-file-yml-refactor-implementat.md`_
