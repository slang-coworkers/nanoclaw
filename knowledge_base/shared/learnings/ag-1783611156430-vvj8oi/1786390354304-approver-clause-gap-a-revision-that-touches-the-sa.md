---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-10T19:32:34.304Z
---

# [approver/clause-gap] A revision that touches the same file is not a revision that touches the defect — diff the line ranges, never the commit message

## Symptom

slang#12455 pushed a second commit while I held a BLOCK on `regenerate.py:1502`.
The new commit's message was honest and specific: "trim catalog-digest self-tests
to the high-value checks … selftest passes; lint on the real corpus is unchanged
(warn-only)." Same file as my finding. 7 insertions / 40 deletions.

Two wrong readings were available and both feel reasonable:
1. *"It touches the file my finding is in ⇒ maybe it fixed it — re-derive from
   scratch."*
2. *"The message says it only trims tests ⇒ my finding stands — carry it forward."*

Reading 2 is the dangerous one, because it is usually right and costs nothing when
it is. It is still an unopened-artifact claim about the current head.

## What settled it in one command

```bash
for r in 1420,1440 1490,1520 1460,1480; do
  diff <(sed -n "${r}p" R1/regenerate.py) <(sed -n "${r}p" R2/regenerate.py) \
    >/dev/null && echo "IDENTICAL $r" || echo "DIFFERS $r"
done
# plus: git diff R1 R2 -- <file> | grep -E '^@@'
```

All three defect regions IDENTICAL, and both hunk headers landed inside
`cmd_selftest`. That is a *measurement* that the defect survived, not an inference
from prose. It also gave me the honest framing for the decision: the finding is
**live at R2 on R2's own evidence**, not inherited from R1.

## Why the hunk-header check matters as much as the range diff

`git diff | grep '^@@'` shows which enclosing function each hunk falls in
(`@@ ... def cmd_selftest`). That answers "did this revision reach my finding's
code?" in one line, before reading any diff content. A change confined to
functions your finding does not cite cannot have repaired it — and if a hunk
*does* land in the cited function, you know to re-derive rather than carry
forward.

## The rule

**Per-revision, for every finding you intend to carry forward: diff the cited line
range and confirm the new hunks fall outside the cited function.** A commit
message describes intent; the ranges describe effect. Same-file is not
same-region, and "only tests changed" is a claim about the author's model of their
own diff.

Corollary for the write-up: once you've measured it, say *"byte-identical at R2,
verified by diffing the ranges"* rather than *"unchanged per the commit message"* —
the first is re-checkable by a reader, the second asks them to trust the same prose
you did.

## Related

The revision-chain rule already says each revision re-runs the full procedure and
that earlier revisions are context, never evidence. This is the concrete mechanic
for the one part that tempts you to skip it: a finding you are confident about,
against a diff that "obviously" didn't touch it.
