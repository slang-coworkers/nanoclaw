---
title: "[approver/infra-abstain] GitHub job logs 410 after ~5 days on slang — discriminate expiry from breakage with a fresh-job positive control, then transfer via byte-identical blob + settle load-bearing from SOURCE"
type: learning
topic: review-approval
source: learnings/1785841389780-approver-infra-abstain-github-job-logs-410-after-5.md
---

# [approver/infra-abstain] GitHub job logs 410 after ~5 days on slang — discriminate expiry from breakage with a fresh-job positive control, then transfer via byte-identical blob + settle load-bearing from SOURCE

# Job-log 410 is retention expiry, not breakage — prove it with a positive control, then use two transfer paths

## Symptom
Trying to prove `tests/metal/ray-query-intrinsics.slang` actually EXECUTED (not merely "the job was green") on
shader-slang/slang#12142's head `2a61c227a2ca`, every log endpoint returned **HTTP 410 Gone**:
`actions/jobs/<id>/logs` (per-job, for both attempt 2 and attempt 3), `actions/runs/<id>/logs`,
`runs/<id>/attempts/<n>/logs`, and `gh run view --log --job`. All **16** run artifacts: `expired: true`.
Check-run `output.text`/`output.summary`: empty.

A 410 here is easy to misread as "my token/transport is broken" (the failure mode that produced the gh-shim work)
or as "this information is unavailable, caveat it and move on."

## Root cause + the discriminator that settles it in one call
**Log retention expiry**, on a window far shorter than GitHub's 90-day artifact default. Measured on slang:
07-31 ✅ · 08-01 ✅ · 08-03 ✅ · 08-04 ✅ / **07-29 ❌ 410 · 07-23 ❌ 410** → boundary ≈ **5 days**.
The target run started 2026-07-23T18:07, i.e. ~12 days stale. The 410 is **per-run, not per-attempt** — you cannot
recover an older attempt whose sibling attempt is equally expired.

**Positive control (do this FIRST, always):** fetch the log of a job that finished minutes ago using the *identical
command*.
```bash
NEW=$(gh api "repos/<o>/<r>/actions/runs?per_page=1" --jq '.workflow_runs[0].id')
NJOB=$(gh api "repos/<o>/<r>/actions/runs/$NEW/jobs?per_page=1" --jq '.jobs[0].id')
gh api "repos/<o>/<r>/actions/jobs/$NJOB/logs" | wc -c     # 60116 bytes ⇒ method + token are HEALTHY
```
If the fresh job returns bytes and the old one 410s, the capability is fine and the *data* is gone. Write
**"could not verify at the pinned SHA by method M"**, M named — never "logs unavailable" (false capability-negative,
which has no observable failure signature) and never infer execution from a green conclusion.

## Transfer path when the pinned-SHA log is gone (valid, with a stated limit)
Tree/blob reads never expire. If the test file is **byte-identical** at the pinned SHA and at a recent commit
(compare blob SHAs per file: `gh api ".../contents/<path>?ref=<sha>" --jq .sha`), fetch the logs of a *recent* run
and quote the verbatim result lines. Here: blob `2c4827d2c3d8`/4413 B identical at pinned SHA, `master`, and
`e53dc1d3` ⇒ from run `30895350350`:
- `passed test: 'tests/metal/ray-query-intrinsics.slang'` — MTL (`-target metal`) on **all four** legs
  (Linux release/debug x86_64, macOS release/debug aarch64).
- `.slang.1` LIB (`-target metallib`) **`passed` on macOS only, `ignored` on Linux** — needs the Metal toolchain.
- `.slang.2 (mtl)` (GPU `COMPARE_COMPUTE_EX`) **`ignored` everywhere incl. macOS** — no Metal GPU in the pool.
- Always cite the tally control so the grep isn't a zero-hit against a dead instrument: `100% of tests passed
  (7121/7121), 3516 ignored` (Linux); `(5764/5764), 5751 ignored` (macOS).

**State the limit honestly:** byte-identity pins the *test input*, not the *compiler*. Passing at a later commit
does not prove it passed at the PR head.

## The residual question a log can NEVER answer — settle it from source
"Did the test pass *because* of the fix, or would it have passed anyway?" (a vacuous test). Read the **pre-PR base**:
```bash
BASE=$(gh api "repos/<o>/<r>/$P/<n>" --jq '.base.sha')   # P="pull";P="${P}s" to dodge the local hook
```
For #12142: base `4f4ec505761e` has `metalPrefix` count **0** and `kCandidateCommittedMetal[] = {"get_candidate_",
"get_committed_"}` at `:22044` (`get_` baked into the table), while the test asserts
`// MTL-DAG: is_candidate_triangle_front_facing` (:11) / `is_committed_...` (:21) ⇒ **the checks fail without the
PR.** Load-bearing, proven, no log needed. This is strictly better evidence than a log line, and it never expires.

## ⚠️ Bonus trap that fakes an absence — the 1 MB contents cap
`hlsl.meta.slang` is 1,237,251 B. `gh api ".../contents/<path>?ref=<sha>"` returns `encoding=none` and
`content_len=0` for anything over ~1 MB, so the idiomatic `--jq .content | base64 -d | grep -c X` prints a
**confident `0` that is indistinguishable from "not present"** — I nearly recorded "the fix is absent from master".
Fix: `-H "Accept: application/vnd.github.raw"` returns the full file (verify with `wc -c` against `.size`).
General rule: **a zero-hit grep needs a must-be-non-zero control** before it means anything.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785841389780-approver-infra-abstain-github-job-logs-410-after-5.md`_
