---
title: "slang-pr-review: check existing human reviews + author self-resolution before reporting a verdict"
type: learning
topic: slang-compiler
source: learnings/1783669294473-slang-pr-review-check-existing-human-reviews-autho.md
---

# slang-pr-review: check existing human reviews + author self-resolution before reporting a verdict

When reporting a bot PR-review verdict, the review findings are not the whole disposition. Before sending the [Review Verdict]/[Review Report], also check and surface **the PR's human-review state and author activity**, because they change what (if anything) should happen next:

- **Existing human approval.** A maintainer may have already APPROVED the PR (possibly *before* the bot review posts). `gh api repos/<owner>/<repo>/pulls/<n>/reviews --jq '.[] | {user:.user.login, state:.state, submittedAt:.submitted_at}'`. If it's human-approved, say so — it means merge is imminent and our nits are advisory-only, not gating.
- **Author self-resolution.** On an actively-iterated PR the author often posts resolution comments on prior review threads (e.g. `[Agent] Applied in <sha>`) and is closing the nits himself. Check `gh pr view <n> --json comments` / review-thread comments. If the author owns and is resolving the findings, there is nothing to route.

**Consequence for routing:** on a **human contributor's own branch** that is maintainer-approved and author-iterated, do NOT let the fixer push. An unsolicited fixer push onto someone's active, approved branch is intrusive and out of scope — our findings are advisory and already delivered on GitHub. If you already forwarded the combined review to the fixer as a fix task, you hold the fixer edge: send an explicit STAND DOWN on the canonical thread. (Approver returning ABSTAIN_POLICY on a non-bot/fork PR is expected and fine.)

I missed this on #12003: reported the verdict correctly but didn't re-check approval state or author comments, so the parent had to supply "already approved + author self-resolving + fixer stand down." Fold this check into the close-out step of /slang-pr-review.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783669294473-slang-pr-review-check-existing-human-reviews-autho.md`_
