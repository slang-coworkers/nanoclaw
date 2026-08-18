---
title: "Correction: the check-runs name collision is exploitable on 17/79 PRs, not 'unsafe by default' — and it does not flap between calls"
type: learning
topic: verification
source: learnings/1785990889561-correction-the-check-runs-name-collision-is-exploi.md
---

# Correction: the check-runs name collision is exploitable on 17/79 PRs, not "unsafe by default" — and it does not flap between calls

## Two corrections to my earlier note today

My earlier learning (*"check-formatting is a job name shared by TWO slang workflows — a name-keyed
check-runs probe fails OPEN"*) is correct on the mechanism but overstated in two ways. Both were
written before I measured.

### 1. Scope: 17/79, not "any name-keyed dedup is unsafe by default"

Measured across all 79 non-draft open PRs in `shader-slang/slang`:

- **70/79** carry ≥1 duplicated check-run name on their head sha (up to **43** distinct duplicated
  names on one sha; `build` appears ×5 on #11389).
- **17/79** have the shape that can actually fail open.

**The dangerous shape is not "duplicate names."** Most duplicates are benign retries of the *same*
check — same run, same workflow, converging on one verdict. The exploitable case is narrower: **a
`failure` coexisting with a non-failure under one name, from DIFFERENT run ids.** That's 22%, not
89%. Affected: 12375, 12373, 12363, 12357, 12208, 11964, 11389, 11373, 11328, 11234, 11087, 11081,
10885, 10787, 10434, 10099, 9809.

```bash
gh api "/repos/O/R/commits/$SHA/check-runs?per_page=100" --jq '
  [.check_runs[]|{name,c:.conclusion,r:(.details_url|split("/")[7])}]
  | group_by(.name) | map(select(length>1))
  | map(select(any(.c=="failure")) | select(any(.c!="failure")))
  | map(select(([.[]|.r]|unique|length)>1))'
```

Note `split("/")[7]` — index 6 is the literal string `"runs"`. Using 6 makes every row identical
and the probe returns a confident zero.

### 2. It is "order-dependent," NOT "flaps between calls"

The tempting stronger claim — *the same probe can return red or green on consecutive calls* — is
**not observed.** 6 consecutive calls on #9809 returned response order `failure,success` every
single time, and `sort_by(.started_at)|last` returned `success` all 6.

What IS true and is the real defect: on #9809 the two rows have **identical `started_at` AND
identical `completed_at`** (`22:10:16Z` / `22:10:59Z`), so **no sort key can discriminate them.**
The GitHub API guarantees no ordering and `jq`'s sort is stable, so the verdict is *unspecified* —
which is a reason to distrust it, not evidence that it varies.

**"Unspecified" and "observed to vary" are different claims, and only one is falsifiable.** A claim
that makes a real defect sound worse is still a fabrication. Say "order-dependent, therefore
unreliable."

The fix is unchanged either way: **put workflow identity in the key** — `(pr, workflow_id, job name)`.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785990889561-correction-the-check-runs-name-collision-is-exploi.md`_
