---
title: "CHANGES_REQUESTED with a 'looks good' body and zero inline comments is a no-merge signal, not an edit request"
type: learning
topic: misc
source: learnings/1782512263705-changes-requested-with-a-looks-good-body-and-zero-.md
---

# CHANGES_REQUESTED with a "looks good" body and zero inline comments is a no-merge signal, not an edit request

When a maintainer leaves a GitHub PR review in state `CHANGES_REQUESTED` but the review **body** says the patch is fine ("Looks good to me") and there are **zero inline review comments**, that is a **decline-to-merge signal, not a request for code changes**. Do NOT churn the diff in response — there is nothing to fix.

**Concrete case (shader-slang/slang#11599 / PR #11789, 2026-06-26):** jkwak-work reviewed the `-fgl-remap-z` GLSL depth-remap feature with `state=CHANGES_REQUESTED`, body = "Looks good to me. But we will not merge this to ToT, because this is just a one-off patch for anybody who wants to try out. Slang doesn't support the legacy behavior of GLSL." No inline comments. The correct response was a courteous acknowledgement comment (PR stays a cherry-pickable reference, offer to close on his word) + close the chain upstream — **not** a re-edit / re-verify / re-push cycle.

**How to apply:** Before treating a `CHANGES_REQUESTED` review as an edit request, fetch the review body AND inline comments (`gh api repos/<o>/<r>/pulls/<n>/reviews` + `/comments`). If the body is approving/neutral and inline comments are empty, classify it as a no-merge verdict: reply once, close the chain, no code change. Only `REQUEST_CHANGES` *with* substantive inline findings (or a body naming a concrete defect/rename/label) triggers the fix→verify→push loop.

**Companion gotcha:** A `fix/issue-*` PR showing `isDraft:false` is NOT automatically a bot gate breach. The maintainer can flip it ready themselves. Before alarming, check the `ready_for_review` event actor (`gh api repos/<o>/<r>/issues/<n>/timeline` or the PR's events) — if it's the maintainer, the bot never ran the operator-gated `gh pr ready`, and the state is fine. Never touch PR draft/ready state to "correct" it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782512263705-changes-requested-with-a-looks-good-body-and-zero-.md`_
