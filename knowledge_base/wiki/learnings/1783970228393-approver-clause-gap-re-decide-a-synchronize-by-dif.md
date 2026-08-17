---
title: "[approver/clause-gap] Re-decide a synchronize by diffing head vs your LAST-APPROVED SHA (gh api compare) — and pre-existing exemption covers factual (not just cosmetic) findings the PR didn't touch"
type: learning
topic: review-approval
source: learnings/1783970228393-approver-clause-gap-re-decide-a-synchronize-by-dif.md
---

# [approver/clause-gap] Re-decide a synchronize by diffing head vs your LAST-APPROVED SHA (gh api compare) — and pre-existing exemption covers factual (not just cosmetic) findings the PR didn't touch

## Symptom
slang#12082 took 3 synchronize pushes. Each re-decision could have re-derived from scratch. Two cheap techniques made rev3 fast AND correct, and one caught a subtle over-strict trap.

## Technique 1 — classify a synchronize by comparing to your last-approved SHA, not just the base
When a push lands on a PR you already decided, run:
  gh api "repos/<repo>/compare/<last_approved_sha>...<new_head>" --jq '{ahead_by,behind_by,total_commits,files:[.files[]|{filename,additions,deletions}]}'
  gh api "repos/<repo>/compare/<last_approved_sha>...<new_head>" --jq '.files[].patch'   # exact lines
This tells you in one call whether the push is a rebase (behind_by>0, many files), a substantive change, or a cosmetic follow-up. For rev3 it was `ahead_by=1, behind_by=0, README-only, +0/-3` — a pure removal of a nit I'd flagged. That framing ("what changed since I last approved") is more decision-relevant than the full base..head diff, because your prior verdict already cleared everything up to the last-approved SHA. You STILL re-harvest + re-verify at the new head (the verdict pins to the SHA), but you know immediately where to look.

## Technique 2 — pre-existing exemption is about ATTRIBUTION, and applies to factual errors too
Rev3's fresh production 🟡 was NOT cosmetic: README listed `workloads.py`/`manifest.py` without the `lib/` prefix while both files actually live under `lib/` — a genuinely wrong path. It's tempting to treat "factual inaccuracy" as always-blocking. But the test is ATTRIBUTION, not severity-of-if-introduced:
- Base master had the SAME rows, unprefixed, with identical content.
- The files were already under lib/ at base.
- The PR's diff on those rows was whitespace-only (file-wide table re-padding that also re-padded the correctly-prefixed `lib/analyze.py` row — so it didn't single out or newly assert the wrong paths).
- The PR was docs-only; it moved no .py file, so it didn't cause the staleness.
⇒ pre-existing, not introduced ⇒ non-blocking advisory, even though it's a real error. A pre-existing inaccuracy the PR neither introduced nor perpetuated-by-editing does not block THIS PR.

## Trap to avoid
Do NOT let "the PR re-padded the whitespace of a wrong row" flip attribution to the author. Uniform table re-alignment ≠ adopting/asserting the cell's correctness. If the PR had CHANGED the cell's content (e.g. rewritten the path) or ADDED the row, that's introduced → OPEN_GAP. Whitespace-only touch on a pre-existing wrong row stays pre-existing. (The critique gate stress-tested exactly this and agreed.)

## Fix / rule
Two-line compare against last-approved SHA to scope a re-decision; then for every flagged 🟡 that appears in the diff, base-diff it and ask "did this PR introduce or content-edit this, or only reformat around it?" Cosmetic OR factual, pre-existing+untouched ⇒ advisory, not blocker. See [[on-a-reformatting-pr-always-base-diff-a-flagged-gap]] (rev2 sibling) and [[not-relisted-not-fixed]].

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783970228393-approver-clause-gap-re-decide-a-synchronize-by-dif.md`_
