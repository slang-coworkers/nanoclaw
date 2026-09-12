---
title: "[approver/challenger-miss] A companion PR's upstream-reference change is not a diff change — verify the diff, not the title"
type: learning
topic: review-approval
source: learnings/1789112010267-approver-challenger-miss-a-companion-pr-s-upstream.md
---

# [approver/challenger-miss] A companion PR's upstream-reference change is not a diff change — verify the diff, not the title

---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788481356485-mgy3e9
written_at: 2026-09-11T07:33:30.267Z
---

# [approver/challenger-miss] A companion PR's upstream-reference change is not a diff change — verify the diff, not the title

## Symptom
On slangpy#1135 a `synchronize` arrived with the PR TITLE changed from "for
slang#12840" to "for slang#12986", and the orchestrator explicitly asked to confirm
the diff/scope still matched. It would have been easy to treat the reference change
as a scope change (or, conversely, to wave it through as "just a merge-of-main").

## Root cause / what was actually true
The upstream companion PR was re-created: slang#12840 (fork PR) was CLOSED unmerged
and superseded by slang#12986 (same-repo, MERGED 2026-09-10) — same breaking change
(matrix layout param gets its own type = the `MatrixLayoutMode` enum). The SlangPy
diff base...head was BYTE-IDENTICAL across all three heads (R1 5e22055, R2 f0b54bb,
R3 eadd30f) — same 2-line `int`→`MatrixLayoutMode` retype, same git blob hashes. The
new heads were "Merge branch 'main'" commits; the change under review never moved.

## How to catch it
- On any title/description/reference change, re-read `gh pr diff` at the new head and
  compare to what you last evaluated (blob index hashes in the diff header are a fast
  equality check). A different upstream PR number does NOT imply a different local diff.
- Independently confirm the referenced upstream PR is the same change and its state
  (`gh pr view <n> --repo shader-slang/slang --json title,state,labels`): here #12986
  MERGED / #12840 CLOSED told the whole story.

## Positive control worth knowing for companion-PR review
For a companion PR to a merged slang breaking change, look for the Slang-side
cherry-pick: `ci-slangpy-trigger-test.yml` sets `SLANGPY_CHERRY_PICK_PR: "<num>"`, so
every Slang "SlangPy Tests" run merges the companion PR into SlangPy before building
against master-Slang. If the breaking-change PR merged with those green, the retype is
already exercised green against the real change — a genuine positive control, not the
weak "no red flags." (Still expect slangpy's OWN CI red-by-design until the
`SGL_SLANG_VERSION` pin bumps to a release containing the enum.)

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789112010267-approver-challenger-miss-a-companion-pr-s-upstream.md`_
