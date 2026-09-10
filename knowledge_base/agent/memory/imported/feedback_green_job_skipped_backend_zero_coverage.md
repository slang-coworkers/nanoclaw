---
name: feedback_green_job_skipped_backend_zero_coverage
description: A green job can mean the backend skipped every test, that the test dir isn't in the PR's run at all, or that the backend ran but the log can't say WHICH code path — verify execution and find the affirmative marker, not the conclusion
metadata: 
  node_type: memory
  type: feedback
  title: "A green CI job whose backend SKIPPED all tests = zero coverage, not validation"
  tags: 
    - ci
    - verification
    - metal
    - gpu
    - coverage
    - slang-rhi
  originSessionId: 86f30980-8c62-4d53-a4a7-5114a82df6ab
---

# A green job whose backend skipped everything proves compilation, not behaviour

**Rule:** never treat a green CI job as runtime validation of a backend-specific code path until
you have confirmed the backend was actually *initialized and executed*. A green job can mean the
device was unsupported, so **every** test for it silently skipped — including the new ones the PR
added.

**Why:** on slang-rhi#802 (Metal bindless DescriptorHandle, slang#10842) the macOS jobs reported
**success** while the log said `Metal: not supported (failed to get shader entry point code)` — the
entire Metal device failed to come up, so all Metal tests skipped. Green proved only that the Metal
TUs *compile*. Reviewer skallweitNV caught it as "Needs testing"; a green-job reading would have
shipped an unexecuted feature. (Cause was unrelated + upstream: `macos-latest` → `macos-26-arm64`
trips slang-rhi's OS-version gate to `metallib_4_0`, which the image's Xcode-16-era toolchain
rejects — tracked as slang#12096.)

**How to apply:**
- Grep the job log for the backend's init/skip signature (`not supported`, `skipped`, `0 tests ran`,
  device-creation failure) — not just the job conclusion. Same family as "grep test-NAME catches
  passed not FAILED" ([[feedback_signature_grep_passed_vs_failed]]).
- Confirm the *count* of executed tests for that backend changed, not that the suite is green.
- Also verify the runner's **feature tier**, not just the OS/arch: the same log showed
  `GPUFamilyApple6 not supported; using per-encoder useResource fallback`, meaning CI exercised the
  *fallback* path — which inverted an earlier "that gap isn't on CI's likely path" claim into
  "CI is exactly where the gap is live."
- When coverage is structurally absent, say so plainly and let the human merge with eyes open —
  this is the ABSTAIN_POLICY / OPEN_GAP posture, same as
  [[project_10842_metal_descriptorhandle_runtime]] and the Metal-HW-gated slang-rhi chains.

**Third shape, one level DEEPER — the backend genuinely executes, but the log can't say which
CODE PATH inside it ran** (slang-rhi#800, 2026-08-03). Metal really came up and all three
formerly-masked `compute-indirect` cases PASSED on both macOS legs (132 vs 129 at base, +3). So
coverage was real — yet the run still could not clear Devin's residency concern, because
`tests/testing.cpp:209-219` routes non-verbose `DebugMessageType::Info` to doctest **`INFO()`**,
whose captured context prints **only on failure**. Of the three residency paths in
`src/metal/metal-device.cpp:112-138`, the env-var fallback emits `Info` (invisible in a passing
non-verbose run), the success path sets `m_hasResidencySet = true` and **emits nothing at all**, and
only `newResidencySet`-failure emits a `Warning`. Both logs had **zero** `[Info]` lines — and that
silence is **uninformative by construction**, not reassuring.
- **"The backend executed" ≠ "the path I care about executed."** Before citing a green run as
  adjudicating a specific concern, find the **affirmative marker** for the path you're claiming ran.
  If the path is silent on success, its absence in the log proves nothing.
- **Reasoning from an absent log line requires TWO proofs, and the second is the one that bites:**
  (a) the line would be **emitted** on the path you're excluding, and (b) it would be **printed at
  that run's verbosity**. Here (a) held for the env-var fallback — it does call `handleMessage` — but
  (b) failed: `Info` goes to `INFO()`, which a passing non-verbose run never flushes. Checking only
  (a) makes the absence look like evidence. (Sharper decomposition of this rule, arrived at
  independently by `slang-pr-approver` on the same chain.)
- **Check the harness's own log-routing before reading absence as evidence.** A message level that
  only surfaces on failure (or under `-v`) makes every passing run look identical regardless of path.
- A test whose expected output equals its zero-initialized input (here `compute-indirect-zero`
  expecting `{0}` from a zeroed buffer) **would also pass on a silent no-op** — it can't discriminate
  either. Identify which cases are load-bearing.
- Same control as always: *could this output have differed if my claim were false?* For "the
  residency-set path was active," no. Cf. the sign-inverted instance in
  [[project_11225_capability_target_incompat_slangpy_break]] — a marker's absence in a 0-failure run
  is **guaranteed**, so it can be neither positive nor negative evidence.
See [[project_slang_rhi_800_metal_dispatch_indirect]].

**Sibling shape — the test DIRECTORY isn't in the PR's run at all** (#12326 / PR #12328,
2026-08-03). Not a skipped backend: an entire suite that no `pull_request` workflow invokes.
`docs/generated/tests/` only runs under `slang-test -test-dir docs/generated/tests`, and the two
workflows that pass it are nightly (`workflow_dispatch` + cron) or coverage-tolerated; the default
testDir is `tests/` (`tools/slang-test/options.cpp:740-744`). So a parser change broke a test there
and PR CI stayed green — the breakage would land and resurface at the 04:00 UTC nightly, attributed
to whatever else ran that night. `_meta/regenerate.md` says it outright: *"Advisory only; never
blocks PRs."*
- **Ask which directories the PR's `slang-test` invocation actually covers**, then whether the file
  you're reasoning about is inside one. "Tests exist and are green" ≠ "these tests ran."
- **A doc describing an intended CI attachment is not evidence it's wired.** That same file names a
  "Lint on PR" check as the attachment point — it does not exist; sweeping every workflow for
  `regenerate.py` returns exactly one hit, in the nightly. Grep the workflows, don't trust the prose.
- **A saturated signal is a dead signal:** the staleness tracker that would nominally flag this
  reports 45 stale + 23 missing out of 68 bundles on clean master, so it can never isolate one
  regression. Check a detector's baseline noise before crediting it as a net.
See [[project_12326_throw_statement_missing_semicolon]].

**Fourth shape — could the ARBITER even run? `filecheck=` tests are `Ignored`, not failed, when it
can't** (slang#11617 / #11616, 2026-08-04). ⛔**READ THE CORRECTION BELOW BEFORE ACTING — the
"arbiter is missing locally" conclusion was RETRACTED the same hour. LLVM FileCheck DOES run in our
local build.** The *mechanism* survives; the *absence claim* did not.

**What survives (source-verified):** `slang-test` never invokes a `FileCheck` executable from `PATH`.
It loads FileCheck **in-process from the `slang-llvm` shared library** —
`TestContext::locateLLVMFileCheck()` (`tools/slang-test/test-context.cpp:95-113`,
`loadSharedLibrary("slang-llvm")` → `findFuncByName("createLLVMFileCheck_V1")`), called at
`slang-test-main.cpp:5917` and **gated at :5915 on `if (hasLlvm)`**. So `which FileCheck`,
`apt install` LLVM, and `pip install filecheck` cannot influence slang-test at all — the *library* is
the dependency. When it genuinely can't load, `filecheck=` tests are **`Ignored`, not failed**.

⛔**What was WRONG, and how:** the claim "`slang-llvm` is absent ⇒ these tests skip" came from
`ls build/Debug/bin/ | grep slang-llvm` returning nothing. The library is at
**`build/Debug/lib/libslang-llvm.so`** (152 MB); the loader searches library paths, so an empty `bin/`
establishes nothing. **A one-directory negative was published as a tree-wide negative.**
`find build -iname '*slang-llvm*'` settles it in one command. ⭐**Name the scope you actually
searched** — cf. [[feedback_search_code_total_count_is_not_a_file_count]] and
[[feedback_narrowing_is_not_testing_check_own_store]].

✅**The empirical answer — run the failable control, don't reason about presence:**
baseline passes → **inject a deliberately broken CHECK into the same file** → `FAILED test:` →
restore → passes. The broken assertion failing is what proves the checker *evaluates*. A "passed"
line alone never does: a skipped test and a passing test are the same color in the summary.

⚠️⭐**`slang-test`'s process exit code was 0 even on the FAILED test** — gating a control on `$?`
makes the control itself inert, i.e. it fails at exactly the job it was built for. **Parse the
`FAILED test:` / `% of tests passed` lines, never `$?`.** Same family as
[[feedback_audit_grep_false_negatives_asymmetric]].
- **Worst case is still the dangerous case:** assertions you hand-edited (resolving a merge conflict
  *in the FileCheck directives*) are the part with the least independent arbitration — so establish by
  control that the arbiter ran, rather than assuming either way.
- If you *do* fall back to a `pip install filecheck` emulator, it's a third-party re-implementation,
  not what CI runs: validate **both directions** and report "passes under a FileCheck-compatible
  emulator; LLVM FileCheck in CI is authoritative" — never "regression suite green".
- ⭐ **A global match-count cannot express FileCheck's *ordered* `CHECK` / windowed `CHECK-NOT`
  semantics** and reports a spurious failure on a file that legitimately has the same pattern twice
  (function-entry scope *and* a restore) — tempting you to "fix" a correct assertion.
- ⭐⭐**The meta-failure was store hygiene, not the build:** a correct 2026-07-02 note already said
  local `filecheck=` tests run; the bad note re-introduced the belief that note had retired, because
  nobody grepped first. **Contradicting an existing note is a signal to re-verify, not to publish.**
  And a false *capability-negative* is the worst class to leave in shared prose — readers act on it by
  **not trying**, so the error never surfaces in anyone's transcript.
- ⚠️ My **own** #12333/#12334 index row says "slang-test ⇒ `Ignored`, not failed when FileCheck absent
  = vacuous green" — the mechanism is right, but it must not be read as "FileCheck is absent here."
Shared learnings: the corrected note is
`/workspace/shared/learnings/1785824734935-correction-slang-llvm-filecheck-my-library-absent-.md`
(supersedes `…1785824518254-slang-test-filecheck-tests-need-the-slang-llvm-lib.md`; the 2026-07-02
`…1783031485208-local-filecheck-is-bundled-…` was correct all along).

---

## ⭐⭐ FIFTH shape — the tests are dead, but they are NOT the coverage: a DENOMINATOR error

**slang#10480, 2026-08-04.** I found an unconditional `SLANG_IGNORE_TEST` at the top of `runTest()`
(`tools/slang-unit-test/unit-test-replay-record.cpp:170`, day-one from #9925) — the macro
`addResult(Ignored); throw AbortTestException();` fires before every guard, so all **8**
`replayRecord_*` cases report `Ignored` and never record or replay. That finding is exact and was
endorsed.

⛔ **My FRAMING was wrong: I called it "a vacuous green — the suite reports success while executing
zero replay coverage."** `slang-triager` corrected it. That file is **one of ELEVEN**
test-bearing files — 10 matching `unit-test-replay-*.cpp` **plus** `unit-test-record-replay-api.cpp`,
which that glob does **not** match (`unit-test-replay-common.h` is a 12th replay file but defines no
tests). ⚠️**State the SET, not just the count** — the verdict *originally* published (since **CORRECTED in place**, see below) "125 tests across 12
`unit-test-replay-*.cpp` files", and no reading of that is true: the glob matches **10** files holding
**120** tests; reaching 125 requires the `record-replay-api` file the glob excludes, and 12 only counts
by including the test-free header. Same 125, three different denominators. ✅**Bound the set and say
what bounds it:** `grep -c 'SLANG_UNIT_TEST' tools/slang-unit-test/unit-test-{replay-*,record-replay-api}.cpp`.
⚠️A wider net (`grep -rl SLANG_UNIT_TEST | xargs grep -l -i replay`) returns **134** by dragging in
`unit-test-repro-validator.cpp` — that's the **`-load-repro`** system, not record-replay; it matched on
one prose comment and a `replayRequest` local, and includes no replay header. **Both figures were INDIVIDUALLY MEASURED** — which is why this survives "check your work": each
half verifies in isolation, only the JOIN is false. ✅**Filter on membership — a subsystem-header
include or a test-name PREFIX — never a substring in prose or identifiers**, which cannot tell
membership from coincidence. **Too wide a scope
manufactures a false refutation** ([[feedback_search_code_total_count_is_not_a_file_count]]) — I nearly
"corrected" a correct 125.

✅**RESOLVED 2026-08-04 — comment `5176004164` PATCHed in place**, verified live by me:
count still **1** (edited, not stacked), `created 07:38:23Z / updated 08:03:19Z`, old "across 12" string
**absent**, now reads "125 replay unit tests across **11** test-bearing files (the 10 matched by
`unit-test-replay-*.cpp`, holding 120, plus `unit-test-record-replay-api.cpp`, holding 5)" — boundary beside
the number. All other claims + the 🤖 disclaimer intact. ⛔**I had recommended LEAVING it** ("costs a
maintainer's attention for no decision change") — **wrong: a REST `PATCH` notifies nobody and stacks
nothing**, so that objection only ever applied to a superseding CREATE. Full write-up in
[[feedback_github_comment_hygiene]]. Measured independently by me at
HEAD `0864e60e6` — `SLANG_UNIT_TEST` counts per file, totalling **125** replay tests, of which only
the **8** child-process ones are dead (`stream-decoder`'s 6 ignores are `#else`-arm compile-config,
not dead). `REPLAY_TEST` (`unit-test-replay-common.h:36`) is now bare
`ScopedReplayContext _scopedReplayContext;` — **no ignore** — and the live tests do real in-process
record→playback round trips, e.g. `unit-test-replay-integration.cpp:582-616`: records a digest,
`switchToPlayback()`, `executeAll()`, then asserts `getStream().atEnd()` so a partially-consumed
stream cannot pass. **Replay coverage is ~117 live tests, not zero.**

⭐⭐ **The defect class: I verified the NUMERATOR (these 8 are dead) and asserted a claim about the
DENOMINATOR (the subsystem is uncovered) without ever measuring it.** Shapes 1-4 are all "the check
didn't run." This one is "the check didn't run, *and I never counted how many other checks did*." One
dead file is evidence about that file — coverage is a property of the **set**.

✅ **The check, one line, and it is cheap:**
```bash
for f in tools/slang-unit-test/unit-test-<subsystem>*.cpp; do
  echo "$(basename $f): tests=$(grep -c 'SLANG_UNIT_TEST' $f) ignores=$(grep -c 'SLANG_IGNORE_TEST' $f)"
done
```
Then **classify each ignore** — unconditional (dead) vs. `#if`/`#else` arm (compile-config) vs.
runtime-guarded. My original single-file read couldn't distinguish these because it never looked at a
second file.

⭐ **What was RIGHT and worth keeping separate from the framing error:** the two things that genuinely
*are* zero — (a) the **out-of-process** record→`slang-replay` round trip the issue asks for, and
(b) **any** replay coverage on `pull_request` (the coverage job is `workflow_call`-only from a nightly
cron, so it cannot gate a PR). Narrating the true gap needed no exaggeration; the overstatement added
risk to a correct finding for free.

⚠️ **Also from this triage — the two secondary defects I reported are structurally real but INERT:**
stale/misnamed `expected-failure` entries only reclassify on a **`Fail`** result
(`test-reporter.cpp:168-169`, `:878-879`), and these tests report `Ignored` ⇒ cosmetic until `:170` is
fixed. ⭐ **A defect's severity depends on whether its trigger is reachable in the current state** —
cf. "arm reachable ≠ arm reached" in [[project_12333_dev_null_output_path_tests]].
