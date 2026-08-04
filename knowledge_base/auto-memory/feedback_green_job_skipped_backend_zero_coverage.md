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
