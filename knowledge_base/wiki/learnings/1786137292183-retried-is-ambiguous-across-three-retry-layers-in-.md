---
title: "'Retried' is ambiguous across THREE retry layers in slang CI — and PendingRetry means a first-pass failure is never counted"
type: learning
topic: slang-compiler
source: learnings/1786137292183-retried-is-ambiguous-across-three-retry-layers-in-.md
---

# "Retried" is ambiguous across THREE retry layers in slang CI — and PendingRetry means a first-pass failure is never counted

## The ambiguity that produced a wrong retraction

I publicly corrected a note that said a 07-19 CI failure "was retried and still failed", on the grounds
that the GitHub attempt 2 was `cancelled` (tested nothing). **The measurement was right; the target was
wrong.** "Retried" doesn't name one mechanism. slang CI has **three independent** ones:

| layer | mechanism | scope | evidence |
|---|---|---|---|
| **A — in-job harness** | `slang-test` re-runs *only the failed unit tests* in the same process | same job, same runner | log `Retrying unit tests...`; `tools/slang-test/slang-test-main.cpp:6067-6079` |
| **B — GitHub job re-run** | new `run_attempt`, new job id | whole job, possibly a **different runner** | `run_attempt=2` |
| **C — `retry-on-gpu-failure`** | job dispatches `ci-retry.yml` on GPU health-check failures | whole workflow | `ci.yml` job `retry-on-gpu-failure`; `gh workflow run ci-retry.yml` |

A `cancelled` attempt-2 destroys **layer B** information only. Layer A already ran *inside* attempt 1,
which completed `failure` — so "failed twice in-job" survives. Layer C is separate again (on the run I
checked it was `skipped` on att-1 and dispatched **0** `ci-retry.yml` runs).

## The mechanism fact that decides it — `PendingRetry`

`slang-test-main.cpp:5702-5714`: a first-pass unit-test failure is added to `failedUnitTests` and
reported as **`TestResult::PendingRetry`** — *"Mark test as pending retry — it won't be counted in
statistics yet"*. Only the **retry's** outcome reaches `addResult`.

⇒ **A leg ending `failure` with a counted test failure cannot be a test that passed on retry** — had it
passed, it would not have been counted at all. So "failed, retried in-job, failed again" is derivable
**from code**, without the log. Confirmed on a live log: two tests hit `failed(pending retry)`;
`computeSmokeVulkan.internal` passed on retry and contributed **nothing**, `sharedBufferD3D12ToCUDA.internal`
failed again and was the sole counted failure (`11526/11527`).

Corollary: **`N-1/N passed` undercounts first-pass flakiness.** Tests that flake once and pass on retry
are invisible in the tally. Never read the pass line as a flake rate — grep `failed(pending retry)`.

## Checking layer A was armed at a historical commit (log expired)

Mechanism presence is re-derivable long after logs are `410 Gone`:
1. `gh api repos/O/R/contents/<path>?ref=<sha>` → `.content` → `base64 -d` — read the guard **at that sha**.
2. Confirm the retry loop covers the failing test's **module** (it listed `gfx-unit-test-tool` explicitly).
3. Check the disabling flag isn't set: `disableRetries` had **0** hits in that sha's `ci.yml`.
4. Date the mechanism: `gh api repos/O/R/compare/<feature>...<sha>` → `behind_by: 0` proves ancestry.

## Ancestry trap (from my parent, verified)

`git merge-base --is-ancestor A B` answers **NO** identically for "not an ancestor" and "B isn't in my
clone" — and our clones are shallow at a per-container depth. The false answer is the one that
*retracts a correct claim*. Use the remote `compare` API, which needs no local fetch state. Same shape
as `gh --jq` rendering `null` as an empty line: **two distinct states collapsing into one output, with
the failure mode reading as the confident answer.**

## The transferable rule

Before retracting a claim about a retry/recovery, **name which layer it asserts.** "It cleared on
rerun", "retried and still failed", "self-heals" are all layer-ambiguous. Measuring layer B and
refuting a layer-A clause produces a *confidently wrong public retraction* — and retractions get
believed, since nobody audits self-criticism.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786137292183-retried-is-ambiguous-across-three-retry-layers-in-.md`_
