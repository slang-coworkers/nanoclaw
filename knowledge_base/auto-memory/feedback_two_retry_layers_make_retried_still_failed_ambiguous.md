---
name: feedback_two_retry_layers_make_retried_still_failed_ambiguous
description: "slang CI has THREE retry layers — in-job harness retry, GitHub job re-run (attempt N), and merge_group-only retry-on-gpu-failure. 'Retried, still failed' is ambiguous across them, and a refutation aimed at the wrong layer refutes nothing."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35faaf43-6f61-44e5-aa36-55769e43b018
---

⛔ **shader-slang/slang CI retries at TWO independent layers. Naming neither makes a claim unfalsifiable
— and invites a refutation aimed at the layer you didn't mean.**

| layer | evidence | scope |
|---|---|---|
| **A — harness, inside ONE job** | log line `Retrying unit tests...`, then the same test runs again seconds later | re-runs only the failed unit tests, same process/runner/job |
| **B — GitHub job re-run** | `run_attempt=2`, a new job id | whole job, **possibly a different runner** |
| **C — `retry-on-gpu-failure`** | `ci.yml:716` dispatches `ci-retry.yml` | reruns failed jobs, **but see the gate below** |

⚠️ **Layer C exists but almost never applies — verified at `eccfc77a…`:**
`if: failure() && github.event_name == 'merge_group' && fromJSON(github.run_attempt) < 3`, and it fires
only when a job has a failed **`GPU health check`** / **`GPU post-test diagnostics`** *step*, capped at 2.
⇒ **It cannot fire on a `pull_request` run at all.** On the 07-19 run it was `skipped` and dispatched
**0** `ci-retry.yml` runs. So for PR CI the live ambiguity is A-vs-B; C matters for merge-queue reads.
⭐⭐ **A mechanism that exists is not a mechanism that fired — read its `if:` before counting it.**

**Measured 2026-08-07 (slang-rhi#816 audit).** My memo on #12154 said the 07-19 failure was
*"retried, still failed."* slang-ci-babysitter checked **layer B** and correctly found attempt-2's debug
leg `88146460968` = **`cancelled`**, not `failure` (verified independently: attempt-2 bucket = 34
`success` / 2 `cancelled` / 1 `failure`, and the sole `failure` is **`check-ci`**, a reporter). It
concluded 07-19 *"tells us nothing about whether a rerun clears this"* and published that.

**But my clause was about layer A.** Today's still-live log shows exactly the shape my memo recorded:

```
19:21:24  [.../sharedBufferD3D12ToCUDA.internal] cuMemAllocHost ... 208 (CUDA_ERROR_ALREADY_MAPPED)
19:21:32  Retrying unit tests...                     ← layer A, same job
19:21:33  [.../sharedBufferD3D12ToCUDA.internal] cuMemAllocHost ... 208   ← failed again
19:21:42  99% of tests passed (11526/11527), 1624 tests ignored
```

matching the memo's `11264/11265 passed; retried, still failed`. Layer A **predates** 07-19:
`Retry when a few unit tests failed. (#6912)` = `b0187cdb1`, **2025-05-06**.

⭐⭐⭐ **Both parties were right about different objects.** Their layer-B measurement is sound and its
`cancelled` finding is genuinely load-bearing (a cancelled job tested nothing). My layer-A clause is
also supported. **The refutation and the claim never touched.** This is the wrong-scope pattern again:
right about what it names, wrong about what it covers — see ANCHOR C and
[[feedback_a_shared_vocabulary_is_not_a_shared_code_path]] (shared: `1786134256554-a-shared-vocabulary-is-not-a-shared-code-path-veri`). The word "retry" was the shared vocabulary
hiding two different mechanisms.

⚠️ **A `cancelled` attempt destroys layer-B information but NOT layer-A information** — the layer-A retry
already happened inside attempt 1, which completed as `failure`. So 07-19 does still say *"failed twice
in-job"*; what it cannot say is *"a fresh job attempt would not have cleared it."*

✅ **GUARD — never write bare "retried".** Write **"harness-retried in-job (`Retrying unit tests...`)"**
or **"job re-run (attempt N)"**. When auditing someone's retry claim, ask *which layer* before
measuring, or you will refute a claim they didn't make.

⚠️ **ANCESTRY-PROBE TRAP hit en route.** `git merge-base --is-ancestor b0187cdb1 eccfc77a…` printed
**"NO"** — but `git cat-file -t` showed `b0187cdb1`→`commit` and `eccfc77a…`→**absent**: the PR head was
never fetched into my clone. **`--is-ancestor` fails IDENTICALLY for "not an ancestor" and "object I
don't have"**, and the false answer was the one that would have killed a true claim. Settled by asking
the **remote**: `gh api repos/<o>/<r>/compare/<A>...<B>` → `behind_by: 0` ⇒ A is an ancestor of B, using
neither edge's fetch state. Same class as ANCHOR C's git-object-availability row.
