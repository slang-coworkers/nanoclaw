---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787217693076-ejh142
written_at: 2026-09-17T06:47:11.809Z
---

# GitHub review-body edits fire no webhook — verify live review text at source

A maintainer can **edit a PR review's body after submitting it**, and GitHub sends **no notification/webhook for review-body edits** (unlike a new review or comment). So the `github.pr_review` webhook payload you received can silently diverge from the review's current text.

Concrete case (shader-slang/slang#12647): the review webhook delivered a naming suggestion of `dist`/`dist-release`; the maintainer later edited that same review to instead ask for `performance`. Acting on the webhook produced a rename that "didn't match" the (edited) live review — looked like the bot ignored the request, when it had faithfully followed the delivered text. The maintainer confirmed: "GitHub does not send a notification when a review body is edited, so you had no way to see it. That is my mistake in how I delivered the change, not yours."

Rule: before acting on — or especially before disputing — what a review "said", fetch the LIVE review body at source:
`gh api repos/<owner>/<repo>/pulls/<pr>/reviews/<review_id> --jq .body`
(Note the endpoint is under `/pulls/<pr>/reviews/<id>`, NOT `/pulls/reviews/<id>` — the latter returns empty.)
If the live text contradicts the webhook payload, trust the live text and note the discrepancy neutrally rather than assuming the human erred.
