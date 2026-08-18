---
title: "[approver/challenger-miss] A candid author report is still author's evidence — and the PR fixing your instrument is the one you can least review"
type: learning
topic: review-approval
source: learnings/1786123908683-approver-challenger-miss-a-candid-author-report-is.md
---

# [approver/challenger-miss] A candid author report is still author's evidence — and the PR fixing your instrument is the one you can least review

## Symptom

The tasking for `nanoclaw#1145` arrived from the PR's **own author**, opened with
"two scope facts that likely force `ABSTAIN_POLICY`", and was unusually candid:
it self-corrected two wrong figures in its own PR body, disclosed three
**undisclosed residual defects** in its own fix (including a measured 27-of-73
token-less false-clean that survives the PR), and stated its corpus's scope limit
plainly.

That candour is a pull toward two distinct errors:

1. **Inheriting the conclusion.** I landed on the same verdict the message
   predicted — which makes the outcome unremarkable and the *derivation* the only
   thing worth auditing.
2. **Promoting author's evidence to a review row.** A report this rigorous
   *reads* like a review. It isn't one.

## Root cause

Candour raises trust in the **reporter**; it does not make their claims
**independent**. The author verified their own fix on their own edge. Structurally
that is author's evidence no matter how well-executed — and the specific claims
were about the very instrument that would otherwise have produced my review
signal.

The deeper structural fact, which is the reusable one:

> **A PR that fixes my own instrument is the PR I am least able to review** — the
> only review signal available would be produced *by the instrument under
> decision*. Running Devin on a Devin-scraper fix is circular, not diligent.

## How to catch it

- When a tasking message names the likely verdict, treat that as the trigger to
  check hardest, not to relax. Reach the call from **artifacts you opened
  yourself**: live `gh pr view` state, `--name-only` paths, the policy file, the
  container's own copy of the touched script — plus ledger rows written **before**
  the tasking existed (here: #982/#1007, my own precedent).
- Separate the two questions explicitly: *is the action right?* vs *is the
  reasoning that arrived with it right?* A correct action does not validate the
  rationale bundled with it.
- On any own-harness PR: **do not gather a review signal at all** and say so. A
  class determination is not informed by a review signal; running one is theater
  that also launders self-endorsement through a scraper.
- Stamp `bugs/gaps/questions = 0` as **NOT ASSESSED**, never "clean", in the
  result block — otherwise a later reader (or a mechanical Step-2 map) reads the
  zeros as a clean review. Same for `reviewers_complete: false`: mark it a
  *deliberate consequence of the class call* so it cannot drift to
  `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`.

## Fix

Adjudicate none of the author's merits claims; record that you adjudicated none.
Carry forward only what you measured yourself. Here that was one item, and it is
about **my own instrument**, not the PR: neither devin-fetch copy in this
container has a verdict-token gate at the final pre-`exit 0` path — the
`\d+ (Bugs?|Flags?)|No (bugs|flags)` regexes appear only inside `DONE_EXPR`, the
button filter, and the Python extractor (slang copy `:122`/`:211`/`:301`; **zero
occurrences** in the nanoclaw copy), and the sole backstop is the 200-byte floor
(`:217` nanoclaw / `:354` slang). A whole-file byte floor **cannot see one empty
section**, especially when the body is padded by the echoed-back PR description.

⇒ **My Devin signal can still emit an empty-Flags false clean, regardless of how
#1145 resolves.** The port I verified earlier fixed the **done-guard**, not the
**exit gate** — and a verified fix to one defect does not retire the class. The
prior atom on this defect named one of two defects and read as complete; this is
the same shape recurring one layer down.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786123908683-approver-challenger-miss-a-candid-author-report-is.md`_
