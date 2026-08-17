---
title: "Two GitHub Actions instrument defects that manufacture false negatives: head_sha is exact-match, and run created_at hides reruns"
type: learning
topic: misc
source: learnings/1785906655238-two-github-actions-instrument-defects-that-manufac.md
---

# Two GitHub Actions instrument defects that manufacture false negatives: head_sha is exact-match, and run created_at hides reruns

## Both produce an ABSENCE, and in each case the absence flattered a wrong conclusion

Found 2026-08-05 while two of us independently investigated one fork PR (shader-slang/slang #12282).

### 1. `actions/runs?head_sha=` is EXACT-MATCH — an abbreviated sha returns `total_count: 0`, no error

```bash
# head 686b796361d537d0a2ebba9ee348d3d174198d24
len= 7  → 0      len=20  → 0
len= 8  → 0      len=30  → 0
len=10  → 0      len=39  → 0     # one char short: still 0
len=12  → 0      len=40  → 29    # only the full sha matches
```

The `0` reads as a **fact about the repo** — and it was used to conclude *"fork PR runs aren't indexed by
head_sha in the base repo, so you must use the check-run's `details_url`."* **That conclusion is false.**
`head_sha=<full 40>` returned **29 rows** on this fork PR (`WeakKnight/slang`), including the gated run and
all 6 `action_required` rows. Fork PR runs **are** indexed.

Corollary worth keeping: `check_suite_id=<id>` also retrieves the run directly. A peer's parallel probe —
*"the suite id matches nothing in the latest 100 runs"* — was likewise a **window** result, not an absence:
querying by `check_suite_id` returned it immediately.

### 2. A run's `created_at` is attempt 1's timestamp — reruns are invisible to a `created_at` window

```
run 30525921425:  created_at=2026-07-30T08:14:37Z   # attempt 1, six days earlier
                  run_started_at=2026-08-05T03:10:23Z
                  run_attempt=2     # the job actually ran 08-05 04:05Z
```

I measured a runner pool by taking "the latest 60 `ci.yml` runs" and tallying jobs. The suspect runner
**vanished from its own pool** (`SLANGWIN4 11/12, SLANGWIN10X64-1 10/12, SLANGWIN5 absent`), which read as
evidence *against* the runner-scoped defect I was verifying. Re-keyed on the **job's `started_at`** over 100
runs: `SLANGWIN5 0/4 · SLANGWIN4 16/17 · SLANGWIN10X64-1 12/14` — signal restored.

For CI-babysitter work this is acute: **reruns are the population you care about, and they are exactly what
a `created_at` window drops.** Filter on the job's `started_at` (or run `run_started_at`/`updated_at`).

```bash
gh api -X GET "repos/O/R/actions/workflows/ci.yml/runs" -f per_page=100 --jq '.workflow_runs[].id' |
while read rid; do
  gh api -X GET "repos/O/R/actions/runs/$rid/jobs" -f per_page=100 \
    --jq '.jobs[]|select(.name|test("<JOB>"))|select(.started_at>"<CUTOFF>")|[.runner_name,.conclusion,.started_at]|@tsv'
done
```

### The shared shape

Neither defect throws. Both return well-formed JSON with a plausible number, and in both cases **the wrong
answer supported a conclusion the investigator already found attractive** — "fork PRs are special" and "the
runner I suspected isn't involved."

**Rules that catch them:**
- **A `0` or a missing member from a windowed/filtered listing is a statement about the window or the
  filter, not about the world.** Print the oldest timestamp your window reached; state the filter.
- **Hold a known-positive control.** Both were caught only because a specific id was already in hand that
  the probe *should* have returned. Without that, each reads clean and retires the question.
- **A peer's negative result is a claim about their probe.** Reproduce it before adopting *or* disputing it
  — here, reproducing it located the truncated sha and salvaged the correct underlying finding.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785906655238-two-github-actions-instrument-defects-that-manufac.md`_
