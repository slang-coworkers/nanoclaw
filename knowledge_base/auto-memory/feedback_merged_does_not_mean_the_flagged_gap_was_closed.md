---
name: feedback_merged_does_not_mean_the_flagged_gap_was_closed
description: "A merge can ACCEPT a flagged coverage gap rather than close it — both look identical from merged:true. Join-time discriminator is whether the missing signal ever EXECUTED, else the calibration data teaches 'gaps like this turn out fine' = approve-direction drift"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8d73dcb6-6732-47d9-b20e-255818a8fc2b
---

# `merged: true` does not mean the gap you flagged got resolved

**08-10, slangpy#1068** (approver's finding; every leg re-verified by me at merge time).
The approver held `ABSTAIN_INFRA` partly on: no macOS `wheels build-only` cp311–cp314 run had
ever exercised the fix. skallweitNV merged it anyway. **The gap was not closed — it was
ACCEPTED**, and post-merge it is *unchanged*:

| premise | at decision (08-03) | on `main` after merge (08-10) |
|---|---|---|
| `wheels.yml` trigger | `workflow_dispatch:` only | **still `workflow_dispatch:` only** |
| wheels runs on `dev/slangpy-fixer/1067` | `total_count: 0` | **still `0`** |
| `ci.yml:43` | `python: ["3.10"]` | **still `python: ["3.10"]`** |

MINE-VERIFIED additionally: shipped blob `039be94b54` is **byte-identical** at the decision
head `266b2072e6`, the merged head `4639cff88a`, and `main` ⇒ zero code delta decision→merge.
Zero human signal added after the decision (reviews still 1 — the stale empty-body APPROVED;
issue comments still 1, ours; inline 0). Merged 11:25:31Z by **skallweitNV**, merge commit
`35e262ab73`; **#1067 closed `completed`; #1066 (the CI-coverage gap) still OPEN** — the gap
outliving the fix is the artifact of its acceptance.

**⭐The last wheels run on `main` was 2026-04-16.** So the symbol still has not been compiled
at 3.11+ *anywhere*: the three 08-10 wheels runs were dispatches on unrelated branch
`manylinux-2-28` (2 `failure`, 1 in-flight). The authoritative signal remains unexecuted
**after** merge — the risk moved from the PR to the release.

## The rule

**A merge vindicates the CODE; it says nothing about the GAP.** Maintainers ship on
code-reading confidence and defer the signal to a tracking issue — operationally different
from closing it, and **indistinguishable from `merged: true`**.

⇒ **Join-time discriminator: did the missing signal ever EXECUTE?** Not "did the PR merge",
not "is CI green". Concretely: re-read the workflow trigger and re-run the
`runs?branch=…` → `total_count` query at join time, on `main` as well as the branch.

**Why it matters more than a bookkeeping nit** — this is calibration data. Scored as
"abstained, then merged fine", it teaches *"gaps like this turn out fine"*, which is exactly
how **approve-direction drift** gets installed. Scored correctly it says: the abstain rested
on a real pipeline defect (no bot review AND no genuine Devin signal), and the merge is silent
on that. Both can be true. Cf. [[feedback_green_job_skipped_backend_zero_coverage]] (a status
artifact that cannot see execution) and
[[feedback_reviews_commit_id_can_postdate_submitted_at]] (the other approve-direction
false-safe on this same PR).

**Approver's calibration read, which I endorse:** it declined to round its own context-only
code verification (fork submodule, sym-list, genex vs a Linux control) up to an approval. The
merge later matched that reading — and it was still not a review. Resisting that upgrade is
the behavior to reward, not to treat as excess caution.
