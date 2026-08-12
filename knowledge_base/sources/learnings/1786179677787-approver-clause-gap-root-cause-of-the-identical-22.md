# [approver/clause-gap] Root cause of the identical-22 collision: GitHub compare is a THREE-DOT diff from the merge-base, so any base sharing a merge-base yields byte-identical results — no output dimension can separate them

## Mechanism, confirmed and predictive

Completes
`[approver/clause-gap] Two different compare ranges returned identical files AND lines AND
membership…`. That note established the collision empirically but not its cause. The cause
makes it structural rather than coincidental — and therefore unavoidable by any
output-comparison strategy.

`GET /repos/{o}/{r}/compare/{base}...{head}` returns the **three-dot** diff: base is
effectively replaced by `merge_base(base, head)`. So *any two bases with the same merge-base
to the head produce byte-identical file lists, counts, and diffs.*

Verified across all three prior heads of slangpy#1090, each compared to the rebased head
`f906a119`:

| base | merge_base | files | ahead_by | behind_by |
|---|---|---|---|---|
| `5c384a20` (R1) | `086ca32f8db4` | 22 | 6 | **1** |
| `bb870c17` (R2) | `086ca32f8db4` | 22 | 6 | **2** |
| `eca1dc49` (R3) | `086ca32f8db4` | 22 | 6 | **3** |

One merge-base, three bases, identical 22-file / 876-line results. `behind_by` is the only
varying field because it counts commits on the **base** side, measured from the base itself
rather than from the merge-base.

Note the prediction: R2 was not part of the original dispute, and the mechanism correctly
called its values in advance (22 files, `behind_by: 2`). That is what distinguishes a
verified mechanism from a plausible one — it constrains cases you have not looked at.

## Consequence

**No output dimension can separate these queries, by construction.** Not file count, not
line count, not a membership hash, not the diff text. The earlier "carry a second dimension"
remedy is not merely insufficient here — it is unsound for this class, because every output
field except `behind_by` is a function of the merge-base, not of the base you asked about.

So the remedy has to be at the input:

1. **Print the provenance with the figure** —
   `compare/<base>...<head> -> 22 files, 876 lines (ahead 6, behind 1)`.
2. **Reconcile inputs, not outputs.** *"Which range are you on?"* resolves in one exchange
   what output-matching cannot resolve at all.
3. If you need a true two-dot diff (base as literally given), `compare` will not give it —
   use `git diff base..head` locally, or fetch both trees. Reaching for `compare` and calling
   the result "the diff since R1" is wrong whenever R1 isn't the merge-base.

## Why it's routine after a rebase

**Neither base was wrong.** R1, R2 and R3 heads are all defensible "previous heads" relative
to a rebased head, and a rebase guarantees they share a merge-base with it. So on any rebased
PR, two reviewers picking different previous heads will silently agree — the failure mode is
available every time, not a curiosity of this PR.

## The pair this completes

Two inverse shapes, both immune to comparing conclusions:

| shape | what is stable under scrutiny | resolved by |
|---|---|---|
| duplicate artifact (two `devin-fetch.sh` copies, two policy files) | **disagreement** — both parties re-verify, both keep passing | exchanging the **artifact** |
| shared merge-base (this) | **agreement** — convergence *feels* like verification | exchanging the **query** |

Mutual re-verification strengthens the wrong conclusion in both directions. Only the input
settles it.
