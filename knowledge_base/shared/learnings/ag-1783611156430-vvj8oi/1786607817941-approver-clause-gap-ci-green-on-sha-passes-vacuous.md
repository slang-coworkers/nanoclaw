---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786605693530-sgpqjn
written_at: 2026-08-13T07:56:57.941Z
---

# [approver/clause-gap] ci_green_on_sha passes vacuously — a Devin-only approve can ship over 4 RED test-slang jobs at head

**Symptom.** On slang#11511 (wave-aggregate coverage counters, bot-authored ⇒ Devin-only tier, Devin 0🔴/0🟡) I drafted WOULD_APPROVE/CLEAN with clauses 6/6. The `ci_green_on_sha` clause "passed" with evidence string `"policy does not require CI green"` (policy v0-shadow-wide sets `require_ci_green:false`). But at the pinned head 4 `test-slang` jobs were RED (linux/macos aarch64 + x86_64), deterministic across 3 retries: `6300/6304` passed. codex DECISION_REVIEW caught it; I then confirmed from the run log (run 31677344961, job 94377214092).

**Root cause.** Two independent gaps compounded:
1. `ci_green_on_sha` passing VACUOUSLY under `require_ci_green:false` carries ZERO bits — its evidence string says so. I read "6/6 pass" as "CI is green" without reading the per-clause evidence. (Same class as the #12084 `ci_green_on_sha passes vacuously ⇒ read the EVIDENCE STRING` lesson — recurred here on a different PR.)
2. The Devin-only tier has NO signal that runs the test suite: Devin reviews the diff, it does not compile/run tests (the recall learning `verifying-slang-pr-emit-locally` says the upstream review pipelines never build). So a test-breaking change sails through Devin AND through a vacuous CI clause. On a normal-tier PR the harvested production review still wouldn't run tests — CI is the only thing that does.

**The actual defect in the PR.** `1 → WaveActiveCountBits(true)` on default-64-bit CUDA/HLSL wave targets changes the emitted atomic addend from `1ULL` to a widened lane count. Two PRE-EXISTING tests (`coverage-counter-width-default-uint64-{cuda,hlsl}.slang`) assert `//CHECK-DAG: 1ULL` and were NOT updated by the PR (grep of the diff = 0) ⇒ they fail. The PR's own updated CUDA tests (`coverage-cuda-atomics:47`, `coverage-function-branch-cuda-atomics:35`) also fail — the widen-before-atomic sequence differs from what the new CHECKs expect. Classic "changed the emitter, missed the pre-existing tests that pin the old emit + got the new CHECKs slightly wrong."

**How to catch it.** On EVERY decision, before Step-3 clears: enumerate `commits/<head>/check-runs`, histogram `conclusion` over `status==completed`, and if ANY `test-*`/`build-*` job is `failure`, pull the failed job log and attribute. A RED head is at minimum an ABSTAIN (not mergeable as-is), regardless of what `ci_green_on_sha` reports — the clause's vacuous pass is NOT evidence of green. This is MOST important on the Devin-only tier, where no other signal exercises the test suite. Do NOT read a `require_ci_green:false` "pass" as "CI green"; read the evidence string.

**Fix (procedure).** Add an explicit head-CI enumeration to the challenger for any PR that touches emit/codegen/tests, independent of the `ci_green_on_sha` clause. A completed-but-red `test-slang` job ⇒ ABSTAIN_POLICY:CHALLENGER_CONCERN (test integrity: PR red at head, human must look), not WOULD_APPROVE. Reserve BLOCK for a verified 🔴 code-logic bug in the review doc; a stale/broken test is a CHALLENGER_CONCERN abstain.
