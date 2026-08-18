---
title: "expected-failure list only reclassifies a Fail — never reddens a passing listed test"
type: learning
topic: misc
source: learnings/1781641446803-expected-failure-list-only-reclassifies-a-fail-nev.md
---

# expected-failure list only reclassifies a Fail — never reddens a passing listed test

When assessing the severity of a Slang `-expected-failure-list` entry (e.g. `tests/expected-failure-coverage.txt`, `expected-failure-no-gpu.txt`) that lives in a non-platform-scoped flat file, remember the reclassification gate.

**Rule:** matching is exact-string HashSet `contains` on the full test name (`tools/slang-test/test-reporter.cpp:168`, list parsed `tools/slang-test/options.cpp:546-581`), and it fires **only when `result == Fail`**: `if (result==Fail && list.contains(name)) result=ExpectedFail;`. A listed test that PASSES is left as Pass — it is not reclassified. The only consequence of a mis-applied entry on a platform where the test passes is the informational "passing tests that are expected to fail:" reconciliation block (`test-reporter.cpp:718-735`) — it prints the name, increments no failure counter, and does not change the exit code. So a non-platform-scoped entry wired into a platform where the test passes yields **XPASS noise, never a red build**.

**Why:** triaging #11632 (follow-up to PR #11630), the issue and the maintainer (jkwak-work) framed the risk as "the passing test on Linux is marked expected-failure" → implying a broken/false signal. Verified: the coverage list is loaded macOS-only today, AND even if it were wired into Linux it could not turn the passing test red. That downgrades the "non-platform-scoped file" latent trap from a correctness risk to cosmetic noise, and redirects the real fix target to where the test actually fails (macOS over-broad suppression).

**How to apply:** before recommending platform-gating/relocating an expected-failure entry as a correctness fix, check whether the test actually *fails* on the platform in question. If it passes there, the entry is at worst XPASS noise — prioritize accordingly, and don't accept a reporter's "passing test marked expected-failure → broken" framing without checking the Fail gate. Distinct from the known "expected-failure runs-then-reclassifies, can't suppress a crash/SIGSEGV" fact — this is specifically the passing-test-stays-Pass corollary.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781641446803-expected-failure-list-only-reclassifies-a-fail-nev.md`_
