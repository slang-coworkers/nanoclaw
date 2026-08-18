---
title: "[approver/infra-abstain] slangpy CI-red signature: test_profiler.cpp timing test flakes on one matrix cell — not PR-driven"
type: learning
topic: slang-compiler
source: learnings/1785486738534-approver-infra-abstain-slangpy-ci-red-signature-te.md
---

# [approver/infra-abstain] slangpy CI-red signature: test_profiler.cpp timing test flakes on one matrix cell — not PR-driven

**Symptom:** `github.ci_failed` on slangpy PR head; check-suite shows exactly ONE failed matrix cell (`build (linux, x86_64, gcc, Release, 3.10)`) while the same platform's Debug build and the clang Release/Debug builds all pass on identical source. The failing step is "Unit Tests (C++)"; doctest summary reads like `199 | 198 passed | 1 failed | 3 skipped`.

**Root cause:** The single failing case is `frame statistics align repeated and intermittent zones` in `tests/sgl/device/test_profiler.cpp` — a profiler timing/statistics test asserting exact per-call CPU-time counts and call counts (e.g. `CHECK(entries()[1].cpu_time_per_call.count == 2)` failing as `1 == 2`, `sample(0).call_count[1] == 0` failing as `1 == 0`). These are inherently nondeterministic under CI scheduling: the number of profiler samples/calls captured varies with timing, so the test flakes. This is a NEW slangpy CI-red signature distinct from the previously-known ones (data-submodule fetch failures; sgl_tests teardown-exitcode flake — see #1082, #1074/#12074).

**How to catch it (triage recipe, read-only, no /pulls route):**
1. `gh api repos/<repo>/check-suites/<id>/check-runs --jq '.check_runs[] | "\(.conclusion // .status)\t\(.name)"' | sort | uniq -c` → if only ONE cell of a same-source matrix is red, suspect flake immediately.
2. `gh api repos/<repo>/actions/jobs/<jobid> --jq '.steps[] | select(.conclusion=="failure")'` → which step (Configure/Build failing = real; a single test failing = often flake).
3. `gh api repos/<repo>/actions/jobs/<jobid>/logs` then grep `ERROR: (CHECK|REQUIRE)` and the `TEST CASE:` / `====` doctest separators to name the failing test file:line.
4. **Decisive check: is the failing test in the PR's footprint?** `gh pr diff <pr> --name-only` (merge-base aware — NOT `gh api compare base...head`, which includes files pulled in by 'Merge branch main' commits). If the failing test file isn't in the PR diff, the failure is not PR-driven.

**Fix / decision impact:** For an approver, a CI failure in a timing-flaky, non-PR-authored test does NOT strengthen the PR's open gaps and does NOT change a standing ABSTAIN:OPEN_GAP. Under `v0-shadow-relaxed` the `ci_green_on_sha` clause is already non-gating (`require_ci_green:false`), so CI state never mechanically gates the decision — but the substantive question ("real regression → stronger verdict?") resolves to no when the failing test is unrelated to the PR's change and is a known timing-nondeterminism pattern. Note it in the session; the reviewer/fixer coworkers own the CI loop, and a `ci_failed` event on the same head is NOT a new revision → no new ledger row. See [[slangpy-1075]].

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785486738534-approver-infra-abstain-slangpy-ci-red-signature-te.md`_
