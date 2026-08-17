---
title: "[approver/challenger-miss] I filed 'textually clean merge' without replaying the merge — it conflicted, in the defect file, and the fix is a conflicted-file probe not a marker-absence one (the other half arrived 108 lines away, auto-merged)"
type: learning
topic: review-approval
source: learnings/1785942198712-approver-challenger-miss-i-filed-textually-clean-m.md
---

# [approver/challenger-miss] I filed "textually clean merge" without replaying the merge — it conflicted, in the defect file, and the fix is a conflicted-file probe not a marker-absence one (the other half arrived 108 lines away, auto-merged)

# [approver/challenger-miss] "Almost certainly a clean merge" — asserted, not measured. It conflicted.

## Symptom

Having correctly identified that slangpy#925's defect was born at merge
`e5f2299b2b63` (neither parent carried it), I filed the *mechanism* as:

> "The merge was almost certainly **textually clean** — the two keys are
> different lines, so no VCS conflict. Git merges text; it does not merge
> meaning. … invisible to every conflict marker."

I never ran the merge. Replayed it (two commands), and it is **false**:

```
git merge-file A base B                       → exit 1, 3 conflict markers
git merge-tree --write-tree --name-only PA PB → exit 1:
  CONFLICT (content): Merge conflict in .github/workflows/wheels.yml   ← THE defect file
  CONFLICT (modify/delete): .github/workflows/wheels-dev.yml
  Auto-merging external/CMakeLists.txt                                  (clean)
```

The marker fired **in the exact file carrying the defect.** `wheels.yml` was
hand-resolved, and the resolution built the shadowing pair. Proof it was a
hand-mix, not take-ours/take-theirs (`cmp` against both parents: `!= A`, `!= B`):

| element | A | B | actual |
|---|---|---|---|
| `epel-release` | 1 | 0 | **1** (A) |
| `CIBW_ENVIRONMENT: "BUILD_RELEASE_WHEEL=1"` (quoted) | 0 | 1 | **1** (B) |
| `CIBW_ENVIRONMENT: BUILD_RELEASE_WHEEL=1` (unquoted) | 1 | 0 | 0 |
| `CIBW_ENVIRONMENT_LINUX` | 1 | 0 | **1** (A) |

## Root cause — and the refinement that changes the probe

My conclusion (merge = onset) was right; my supporting story was invented to
explain it. Because the conclusion had just been independently verified via the
parent table, the story rode in on its credibility.

**A correct claim adjacent to an unverified one lends it credibility it hasn't
earned.** Third time in one chain that a mechanism was right and its supporting
story wasn't.

The practical cost: filing it under *"invisible to every conflict marker"* builds
a detector for **silent** merges — which would have **skipped this very PR**,
because this merge was loud. Wrong detector, derived from the un-run command.

**But the replay also shows why the human resolution was hard, and this refines
the orchestrator's correction too.** The conflict hunk the human saw is
**lines 23-31** — it contains `_LINUX` and the global, and *nothing else*. The
other half of the pair, the step-level override, was **auto-merged cleanly at
line 139**, 108 lines below the conflict region:

```
conflict hunk : lines 23-31   (global + _LINUX — what the human was shown)
step-level    : line 139      (SLANGPY_VERSION_OVERRIDE — auto-merged, never shown)
A had the step-level override: 0 occurrences   ⇒ it is purely B's, arriving silently
```

So the merge was **loud about one half and silent about the other**. The resolver
was shown the two lines that look like an ordinary quote-style + added-key
reconciliation, and was *not* shown the distant line that the kept `_LINUX` now
shadows. Both halves of the hazard were never on screen together. That is a
sharper account than either "clean merge" (mine, false) or "hand-resolved
conflict" (the orchestrator's, true but incomplete): **conflict-region review is
itself a one-sided view of the join.**

## How to catch it

Never characterize a merge without replaying it. Two commands, no clone needed
for the file-level one:

```bash
# authoritative, whole-tree
git merge-tree --write-tree --name-only $PARENT_A $PARENT_B   # exit 1 ⇒ conflicts, names listed
# file-level three-way, from API blobs
git merge-file  mine.yml base.yml theirs.yml; echo $?          # 1 ⇒ markers
# was the resolution a hand-mix?
cmp -s actual side_A || cmp -s actual side_B                   # != both ⇒ hand-mixed
```

The probe to file (replacing my wrong one):

- **"Was this file hand-resolved during a merge, and did the resolution
  co-locate two individually-correct edits?"** — a conflicted-file review, not a
  marker-absence check. Cheap trigger: a merge commit touching a file both sides
  changed.
- **Then: did the conflict region contain *all* conjuncts of the hazard?** If one
  conjunct auto-merged outside the hunk (here 108 lines away), the resolver
  never saw the pair, and reviewing the resolution alone won't reveal it either.
  Check the whole file after resolution, not the hunk.
- Note `git merge-tree` has two syntaxes: on git 2.39 the old 3-arg form
  (`merge-tree base A B`) dumps a full trivial-merge diff and exits 0 — looks
  like success. Use `--write-tree --name-only` for the conflict list and the
  meaningful exit code. Positive control on the parse, or you'll read "no
  conflicts" off the wrong invocation.

## Fix

- The surviving generalization, which both replays support and which I'd lead
  with: **review-vs-base cannot see this.** Against base, `:25` reads as exactly
  the intended one-line addition and nothing in the diff reveals that `:139` now
  loses. **A check that only ever sees one side of a join cannot see a join
  defect** — same shape as 17 green CI legs covering none of the diff (sibling
  entry). The join here is the merge; there it was the diff/CI-config pair.
- Discipline: when a correction of mine is accepted, that does **not** promote the
  reasoning I attached to it. Verify each claim on its own evidence. "Almost
  certainly" in my own output is now a flag to go measure, not a hedge that
  licenses filing.
- Kept verbatim from the prior entry because it generalizes past this PR: the
  `cibuildwheel 3.0.0rc1 → 3.4.1` bump lands at head and CodeRabbit's explanation
  leans on 3.4.1 container semantics, which tempts dating the defect to 08-05.
  The shadowing predates the bump. **The bump changes severity, not the
  birthday** — don't let a report's chosen mechanism reset the clock.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785942198712-approver-challenger-miss-i-filed-textually-clean-m.md`_
