---
title: "#12177 CLOSE-OUT: slang-test verbosity fix merged — memo P2 corrections (pre-parse timing + Not-Supported stays ungated)"
type: learning
topic: slang-compiler
source: learnings/1784683587359-12177-close-out-slang-test-verbosity-fix-merged-me.md
---

# #12177 CLOSE-OUT: slang-test verbosity fix merged — memo P2 corrections (pre-parse timing + Not-Supported stays ungated)

**#12177 RESOLVED** — PR #12180 merged into master (jkwak-work, merge commit 7002bbe6, `Closes #12177`, issue CLOSED/COMPLETED 2026-07-22). Fix entirely in `tools/slang-test`, +79/−31, 5 files incl. a new regression unit test. This corrects/refines the earlier learning "slang-test -v failure ignored in parallel + capability discovery (#12177)".

**Final fix shape:**
- P1 (parallel `passed test:` lines): folded reporter config into `TestReporter::init(const Options&)` so single-run + per-worker reporters share ONE config path — workers no longer keep the ctor-default `Info`. (Principled Approach B, not the minimal `m_verbosity=` patch; kills the #11911-class worker/main drift for good.) Regression unit test `slangTestReporterInitFromOptions` pins init propagation.
- P2 (capability discovery): gated on `verbosity >= Info`.

**TWO corrections to my original triage memo's P2 (both surfaced in the fix round, both I verified @HEAD):**
1. **Pre-parse TIMING gotcha.** My memo said "gate the `Supported backends:` block at slang-test-main.cpp:5850-5878 in place." WRONG *where*: that block prints at :5851 but `Options::parse` isn't called until :5921 (70 lines later), so at print time `context.options.verbosity` is still the ctor-default `Info` → an in-place `>= Info` gate is a NO-OP under `-v failure`. Fix: accumulate the names in the pre-parse block (it must still run there — it also sets `availableBackendFlags` at :5863 and registers pass-through categories at :5872) and print them, gated, AFTER parse. The OTHER half — `_getAvailableRenderApiFlags` `Check <api>:` prints — IS fine to gate in place, because all its call sites (4917/5605/5656/5962) are post-parse. Lesson: when recommending "gate this print on an option," check the print runs AFTER that option is parsed.
2. **Resolution shape — `Not Supported` stays UNGATED.** Maintainer jkwak's inline review: "Not supported case should show up for `-v failure`." Only the positive `Check <api>: Supported` + `Supported backends:` aggregate gate on `>= Info`; the `Not Supported` branches always print — a missing/failed backend is signal a `-v failure` user needs, not noise.

**CI-parse constraint held** (from the original learning): `.github/actions/common-test-setup/action.yml:94` greps `Supported backends:` at default `Info` — preserved byte-identically; "Common Test Setup" passed in CI. The one red CI job (`gfx-unit-test createBufferFromHandleD3D12.internal`, Windows-debug-GPU only) was a flaky D3D12 gfx test unrelated to this test-tooling diff.

**Process:** self-filed+self-assigned by jkwak → parked under `no-autofixer-jkwak-self-filed` until he commented "make a PR"; then triager→fixer handoff → draft → human flipped ready → APPROVE_WITH_NITS peer + maintainer approval → merge.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784683587359-12177-close-out-slang-test-verbosity-fix-merged-me.md`_
