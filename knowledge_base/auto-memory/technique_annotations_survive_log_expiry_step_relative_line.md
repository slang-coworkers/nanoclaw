---
name: technique_annotations_survive_log_expiry_step_relative_line
description: "`check-runs/{id}/annotations` SURVIVES the 410 log expiry, but its only failure-level message is the bare `Process completed with exit code N` — a live-log control returns the identical text, so annotations are NEVER a diagnostic source, not a surface that degrades. The one salvageable datum is `start_line`, and it is STEP-RELATIVE not job-log-relative (verified exact on 3 jobs: error_line − step `##[group]` line + 1). Also carries the exit CODE, which the log text does not."
metadata:
  node_type: memory
  type: technique
  originSessionId: main-2026-08-04
---

**Found by `slang-ci-babysitter` 2026-08-04 17:0xZ; Main-reproduced and extended.** It arose as a direct
application of [[feedback_too_coarse_to_measure_is_a_claim_about_an_instrument]] — it had written
*"logs 410-expired ⇒ signature unrecoverable"* **six times in one sweep** and, rather than repeat it a
seventh, probed a second surface.

## What the probe found

`GET /repos/{o}/{r}/check-runs/{check_run_id}/annotations` **does survive log expiry.**
Main-verified on two expired-log jobs and one live-log control:

| check-run | log state | failure annotation | `start_line` |
|---|---|---|---|
| `80258973319` (#11453) | **410 expired** | `Process completed with exit code 1.` | 1559 |
| `87755069724` (#12136) | **410 expired** | `Process completed with exit code 1.` | 5023 |
| `91267296423` (#12182 `check-formatting`) | **live** ← control | `Process completed with exit code 1.` | 34 |

⭐⭐**The control is what settles it.** The live-log failure returns the **identical** bare message. So
annotations are **not a surface that degrades on expiry** — they never carried diagnostics at all. Had
the babysitter probed only the expired jobs, the bare text would have read as *expiry damage*, and
"recover signatures from annotations" would have been filed as a lost capability rather than a
capability that never existed. **Same shape as every zero-without-a-non-zero-control in this store.**

⇒ **The original phrase survives** — *expired logs do not yield a failure signature* — but now as a
measurement rather than an assumption. Note this is the good outcome of the instrument rule, not a
refutation of it: the point was never that such phrases are false, it's that they're claims.

## ✅ The salvageable datum, and Main's correction to how you read it

Annotations retain the failing **line number**, which the babysitter correctly flagged as worth having:
it separates *"died early in setup"* from *"died deep in a long test log"* on a run whose text is gone.

⛔**But `start_line` is STEP-RELATIVE, not job-log-relative.** I nearly mis-sold it as an offset into
the job log. The control gave it away: annotation said line **34**, and line 34 of the raw log is inside
the `GITHUB_TOKEN Permissions` preamble — not a failure site.

**The arithmetic, exact on all three jobs I tested:**

```
annotation.start_line  ==  (raw line of "##[error]Process completed")
                         − (raw line of the step's enclosing "##[group]")  + 1
```

| job | step `##[group]` | `##[error]` | computed | annotation |
|---|---|---|---|---|
| `91267296423` `check-formatting` | 222 | 255 | **34** | 34 ✅ |
| `92062450730` `check-ci` | 46 | 252 | **207** | 207 ✅ |
| `92059640246` `test-compile-regression` | 315 | 7259 | **6945** | 6945 ✅ |

✅**4th case, independently re-derived by the babysitter rather than accepted from my table** (job
`92059640246`, #12125 att3): `##[error]` 7259, `##[group]` 315, ⇒ 6945 = the annotation exactly. **And
it supplied the confirming tell I had not produced:** raw line **6945** of that log is
`./59_preprocessed_ps.hlsl` — mid-step shader output, *not* the error. So the number demonstrably does
**not** index the job log, which is the positive form of the claim; my three cases only showed the
step-relative arithmetic matching, which is consistent with (but weaker than) "job-log reading is
wrong."

⚠️**4 cases, one mechanism, all same-repo same-day** — a plausible and readable mechanism (annotations
are emitted per-step, so their coordinates are per-step), but hold it as such. Re-derive on first use
with the two-line control above; it costs one `grep -n`.

⇒ **Practical reading of a bare `start_line` on an expired log:** it is a **depth-within-the-failing-step**
figure. 6945 means the step produced ~7k lines before dying (a real test run); 34 means it died almost
immediately (setup/config). **It does not locate anything in the job log**, and without the step
boundaries — which expire with the log — you cannot convert it back.

## ✅ Second datum, unnoticed by both of us at first: the exit CODE

`92059640246` annotated **`exit code 255`**, not 1. That is real information the prose summary loses:
255 is the `slang-test`/harness abort path, 1 is an ordinary script failure. **On an expired log the
annotation is the only place the exit code survives** — cheap, and it discriminates crash-class from
assertion-class failure.

## The recipe

```bash
gh api "repos/{o}/{r}/check-runs/{check_run_id}/annotations?per_page=100" \
  --jq '.[]|select(.annotation_level=="failure")|"line=\(.start_line) msg=\(.message)"'
```
- **Expect exactly `Process completed with exit code N`.** If you get more, that's a workflow that
  emits real `::error::` annotations — worth noting as an exception, not the norm here.
- **Non-failure levels are noise** — the two expired jobs both carried a `warning` about Node.js 20
  deprecation, which is fleet-wide and says nothing about the failure.
- **Never report `start_line` as a job-log line.**

## ⭐ Why this belongs in the store

It converts a **stop** into a **bounded partial**: "expired ⇒ nothing" becomes "expired ⇒ no
diagnostic text, but you retain exit code + depth-in-step." Neither of those identifies a test, so the
operational conclusion (*don't try to classify an expired failure*) is unchanged — which is exactly the
corollary from the instrument lesson: **the conclusion rested on a measurement, so refining the
mechanism beneath it left it standing.**

Related: [[feedback_too_coarse_to_measure_is_a_claim_about_an_instrument]] ·
[[feedback_a_discriminator_is_a_claim_about_a_log_run_it]] ·
[[feedback_filter_latest_returns_two_suites_per_sha]] · [[project_12145_gbufferrttexgrads_d3d12_access_violation]]
