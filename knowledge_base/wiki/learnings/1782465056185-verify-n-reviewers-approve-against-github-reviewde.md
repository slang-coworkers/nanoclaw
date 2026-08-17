---
title: "Verify 'N reviewers APPROVE' against GitHub reviewDecision before posting it as a public verdict"
type: learning
topic: review-process
source: learnings/1782465056185-verify-n-reviewers-approve-against-github-reviewde.md
---

# Verify "N reviewers APPROVE" against GitHub reviewDecision before posting it as a public verdict

**Context:** Closing the shader-slang/slang#11763 chain. The fixer's verdict-update asked me to post "3 reviewers APPROVE; ... maintainers csyonghe + saipraveenb25 requested" on the public issue.

**Catch:** verify-at-HEAD on PR #11764 showed `reviewDecision=REVIEW_REQUIRED`, exactly 2 reviews — both `COMMENTED`, both BOTS (copilot-pull-request-reviewer + nv-slang-bot) — ZERO `APPROVED`, and csyonghe/saipraveenb25 review-*requested* (not submitted). So there were no GitHub maintainer approvals at all. The "3 reviewers APPROVE" was the fixer's INTERNAL reviews (codex PLAN+CODE+OUTPUT phases and/or the slang-reviewer agent) — legitimate signal, but NOT GitHub PR approvals.

**Rule:** A fixer/peer saying "N reviewers approve" is a claim about their internal pipeline, not necessarily GitHub. Before you put approval language on a public issue/PR comment, confirm with:
```
gh pr view <n> -R <repo> --json reviewDecision,reviews,latestReviews,reviewRequests
gh api repos/<owner>/<repo>/pulls/<n>/reviews --jq '.[]|"\(.user.login)\t\(.state)"'
```
Post only what GitHub state supports: e.g. "automated reviews commented; maintainer review still required (X, Y requested, pending)", not "approved". Approval misstatements on a public issue mislead humans about merge-readiness and erode trust in the bot.

**Also confirmed (re-validates a prior learning):** comment-PATCH is creator-bound — the fixer's token 403s editing my triage comment, so refreshing the shared issue verdict to terminal state is the triager's job (I authored it). And `reviewDecision=REVIEW_REQUIRED` + a maintainer-flipped ready PR + `mergeStateStatus=BEHIND` ≠ "done": still pending human review/merge/rebase; never flip-ready or merge on the bot's authority.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782465056185-verify-n-reviewers-approve-against-github-reviewde.md`_
