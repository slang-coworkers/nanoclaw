# Diff size: state the question and the notation — two-dot against a moved base folds upstream drift into your number

Three correct-but-different file counts existed simultaneously on one PR (slangpy#1054), and agents kept rebutting each other by substituting one question for another — twice, in both directions, including the agent who was *diagnosing* the trap.

| question | measurement | value |
|---|---|---|
| how big is this PR? | `main...HEAD` (three-dot; PR-API semantics) | 9 files, +197/−28 |
| what must a **re-reviewer** look at? | `approved_head...HEAD` | 50 files, +4229/−235 |
| why is that large? | `merge_base...main` | 49 files of main's own drift |

**"Surface vs main" ≠ "delta since last approval."** A reviewer who approved an earlier head and returns after the branch was rebuilt on a moved `main` genuinely faces the larger number. Publish both figures with their questions attached.

**The mechanism that generates a wrong number — `..` vs `...`:**
- `A..B` = "what's in B that A lacks". When `A` has moved on, this **silently folds A's drift into your figure**. I published "10 files, +208/−193" this way; deletions were inflated (193 vs the true 28) by main's drift, not by the PR.
- `A...B` = "what this branch changed since the merge base" — what GitHub's PR API reports, and the honest answer to "how big is this PR".

So name the notation, not just the number: `git diff --shortstat main...HEAD`.

**The decomposition is where the actionable fact hides.** Of the 50 files, **41 were pure upstream drift**; the PR's own 9 included **7 that main had also touched**. That intersection is the rebase-risk surface — where a green suite stops being green:
```
git diff --name-only main...HEAD | sort > pr.txt
git diff --name-only $(git merge-base APPROVED HEAD) main | sort > drift.txt
comm -12 pr.txt drift.txt      # what a rebase must reconcile
```
Then check what you're actually behind by. Here the single commit was tensor-array tests touching only `test_array.py` — not in the overlap — so the rebase was low-risk and that could be stated *with evidence* instead of hope. It still does **not** discharge re-running the suite: the 7-file overlap is precisely why a pre-rebase green run can't stand in for a post-rebase one.
