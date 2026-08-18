---
title: "[approver/challenger-ci-gate] A main-merge synchronize can't clear a code-level 🔴 — diff the two heads before assuming the push addressed it"
type: learning
topic: review-approval
source: learnings/1785496402847-approver-challenger-ci-gate-a-main-merge-synchroni.md
---

# [approver/challenger-ci-gate] A main-merge synchronize can't clear a code-level 🔴 — diff the two heads before assuming the push addressed it

## Symptom
slangpy#1082 R3: a `synchronize` push arrived and the tasking hoped it might clear
the prior head's Devin 🔴 (native buffer-contract at torch_bridge_impl.cpp:126). It
did not — the push was a **merge of `main`** (upstream PRs + merge commit) that
touched only unrelated files (texture_loader, a device test, CMakeLists). The
flagged file was byte-identical to the prior head, so the 🔴 recurred verbatim and
the decision stayed ABSTAIN_POLICY/CHALLENGER_CONCERN.

## Root cause / the rule
On a re-review, don't infer from "a new commit landed" that the concern was
addressed. Compute the actual delta between the prior decision head and the new head
first:
- `gh api repos/<r>/compare/<prevhead>...<newhead> --jq '{commits:[.commits[].commit.message], files:[.files[].filename]}'`
- If the differing files don't include the file/path your prior concern was on, the
  concern is unchanged. Confirm by fetching the specific file at the new head and
  `diff -q` against the prior-head copy.
A `main`-merge (or any push whose delta is entirely elsewhere) changes the PR's
base but not its contribution to the flagged code — so a code-level 🔴/gap on an
untouched file persists by definition.

## Also worth noting
- Still re-run the full procedure (fresh harvest, fresh head-current Devin, fresh
  clauses, CI settle) — the merge CAN change CI outcome (new base may fix/break the
  build) even when it doesn't touch your flagged code. Here CI stayed green 12/12.
- The net PR diff can shrink/stay-same across a merge (GitHub shows PR diff vs the
  updated base); use the head-to-head compare, not just the PR diffstat, to see what
  the push itself did.

## Transferable rule
"New push" ≠ "concern addressed." Diff prevhead...newhead; if the flagged path isn't
in the delta, the prior code-level disposition stands — say so explicitly and name
what WOULD move it (a change to the flagged file, or a human sign-off).
Related: [[approver-challenger-miss-head-current-red-caps-at-abstain]],
[[review-approver-challenger-calibration]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785496402847-approver-challenger-ci-gate-a-main-merge-synchroni.md`_
