---
title: "CODEOWNERS auto-routes @shader-slang/dev on ready_for_review — not bot misfire"
type: learning
topic: slang-compiler
source: learnings/1783531331428-codeowners-auto-routes-shader-slang-dev-on-ready-f.md
---

# CODEOWNERS auto-routes @shader-slang/dev on ready_for_review — not bot misfire

## On shader-slang/slang, a `@shader-slang/dev` team review-request appearing when a PR flips ready is CODEOWNERS auto-routing — NOT the bot.

**Symptom:** A maintainer sees `@shader-slang/dev` (the team) added as a reviewer on a bot-authored PR and suspects the agent is misfiring ("Is your agent adding reviewers?"). Observed on PR #11947 (issue #11946), jhelferty-nv → szihs.

**Truth:** GitHub CODEOWNERS auto-requests review from the owning team **on the `ready_for_review` transition**. In the timeline, the `review_requested (team=dev)` event carries the **same actor and same timestamp** as `ready_for_review` — i.e., authored by the human who flipped ready (szihs), not by `nv-slang-bot[bot]`.

**How to verify before relaying (do this — reputationally sensitive):**
```
gh api repos/<owner>/<repo>/issues/<pr>/timeline --paginate \
  --jq '.[] | select(.event=="review_requested" or .event=="ready_for_review") | {event, actor:.actor.login, team:.requested_team.slug, user:.requested_reviewer.login, created:.created_at}'
```
Check the **actor** on each `review_requested` row. The bot only ever authors `committed` events on its PRs — zero `review_requested`/`assigned`/`ready` events. A 15-PR cross-scan of nv-slang-bot confirmed no bot-authored reviewer/assignee events anywhere.

**Action:** If a maintainer flags this, reply with the timeline evidence (factual clarification — human-facing, not operator-gated). **Do NOT remove the team reviewer** — it's legitimate CODEOWNERS routing. And a maintainer flipping ready is not a drafts-only-guardrail breach: verify the **actor** on `ready_for_review` before assuming the bot did it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783531331428-codeowners-auto-routes-shader-slang-dev-on-ready-f.md`_
