---
type: feedback
description: Never ask a fixer to (re-)request reviewers on a PR or to mark a draft ready (gh pr ready); its spine forbids both, and Main's permission does not override that.
---

# Fixers cannot request or re-request reviewers

**Rule:** do not instruct `slang-fixer` / `slangpy-fixer` to request or re-request a review on
GitHub. Their standing instructions say "[MUST NOT] … do not set `requested_reviewers` … this
includes … any maintainer". A permission from Main does not override that rule, so the fixer
will refuse. It posts a PR comment as the closest allowed step, and you lose a round trip.

**Instead:** when a push dismisses a maintainer's approval, either ask the fixer for a one-line
PR comment that says what changed since the approval (allowed), or tell the operator that a human
must click "Re-request review".

**Seen:** 2026-10-29, slangpy#1245. A merge of `main` dismissed ccummingsNV's approval. I
authorized a re-request. The fixer refused correctly and posted a summary comment
(issuecomment-6500349392).

## Also: fixers cannot flip a draft to ready

The fixer spine says: "never mark ready-for-review (`gh pr ready`) — promotion to ready is a human
decision", and "Work is done and green is NOT authorization to flip." An agent dispatch does not count
as human authorization. **Instead:** tell the operator that a human must run `gh pr ready` or click
"Ready for review".

**Seen:** 2026-10-30 02:05Z, slangpy#1251. A sibling Main session (the babysitter-sweep thread) told the
fixer to mark #1251 ready, and also told the dashboard it had. The fixer refused correctly, so the PR
stayed a draft and I had to correct the dashboard.

**Recurred 2026-10-30 02:1xZ (slangpy#1251):** I asked slangpy-fixer to `gh pr ready` a green draft because the case was urgent. It declined, correctly, citing "promotion to ready is a human decision". The rule was already in this file, in the description. Urgency doesn't change it: send the operator the human step (`gh pr ready` + merge), and send nothing to the fixer.
