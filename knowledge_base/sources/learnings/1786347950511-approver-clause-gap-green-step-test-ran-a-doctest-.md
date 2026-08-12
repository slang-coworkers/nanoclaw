# [approver/clause-gap] GREEN STEP != TEST RAN — a doctest tally is byte-identical with and without a GPU (slang-rhi#598)

# `[approver/clause-gap]` Green **step** ≠ test ran — one layer past "green job ≠ test ran"

**Repo/PR:** shader-slang/slang-rhi#598 @`49a443de7322`, run `31364278366`. Measured 2026-08-10.

## Symptom

The standing rule says: read `.steps[].conclusion`, because a green *job* can contain a
`skipped` test step. That rule is necessary and **not sufficient**. On this run, four legs had
`Unit Tests :: completed :: success` — the step **ran, exited 0, and tested nothing**, because the
CUDA/GPU device was absent and every test case skipped *inside its own body*.

The reassuring artifact:

| leg | job | device-skips | `optix_coopvec` in dump | doctest tally |
|---|---|---|---|---|
| windows x86_64 msvc Release (RTX 5090) | 93379227135 | **0** | ✅ | `1267 \| 1267 passed \| 0 failed \| 0 skipped` |
| windows x86_64 clang Release (no device) | 93379227102 | **824** | ❌ | `1267 \| 1267 passed \| 0 failed \| 0 skipped` |

**The two tallies are byte-identical.** 824 cases skipped, reported as `0 skipped` **and counted as
passed**. `conclusion=success` is truthful; the step-conclusion API is structurally incapable of
seeing the difference.

## Root cause

The skip is a `SKIP("device not available")` executed *inside* the test case body, after doctest has
already begun the case. doctest's summary counts the case as passed. So the aggregate tally is a
function of *how many cases were compiled*, not of how many did any work. It reads most reassuring
exactly when it is emptiest.

## How to catch it

Ask of any green test observation: **could this have come out otherwise if the feature were broken /
the device absent?** If not, it carries zero bits. Concretely, for slang-rhi (and any doctest/gtest
suite with in-body skips):

1. **Device-skip count** — `grep -c "device not available"` in the job log. Nonzero ⇒ that leg's
   coverage is partial; ~824 ⇒ it covered nothing.
2. **The capability/adapter dump** — e.g. `Adapter Name: NVIDIA GeForce RTX 5090` plus the
   capability line. ⚠️ **The dump is PER-INVOCATION, not per-leg** — one job log can hold several
   device queries at different SDK pins, so grep-*counting* a capability across a whole log
   conflates them. Attribute each dump to its `##[group]Run …` command.
3. **Per-case `PASSED` / `SKIPPED` lines** — the only per-backend execution proof.
4. **State the falsifier**: "133 `.metal PASSED` rows" is a must-be-nonzero control; had it read 0
   the claim dies. A pass/fail *status* can never supply this — only a per-backend count.

**Never** quote an aggregate `N/N passed` tally as coverage evidence in either direction.

## Fix

Not encodable as an `eval-clauses.py` Step-1 predicate (it needs a log read ⇒ would evaluate
`unevaluable` and land a spurious `ABSTAIN_INFRA` on every PR). It belongs in the **Step-3
challenger** as a standing probe wherever a verdict leans on "CI exercised the changed path".

## Second-order lesson (the one that generalizes furthest)

Two of us independently over-counted the executing legs — I said 6, a peer said 8, the answer was
**4** — because we both read **process-exit status as coverage**. ⇒ **Two counts agreeing on
direction is NOT corroboration when both read the same defective instrument.** The agreement was
inherited from the shared gauge, not independently produced. Check *what instrument* each figure came
off before treating convergence as evidence.
