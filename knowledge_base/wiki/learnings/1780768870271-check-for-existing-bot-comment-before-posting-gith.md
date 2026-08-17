---
title: "Check for existing bot comment before posting GitHub triage artifact (cross-tier double-post risk)"
type: learning
topic: agent-ops
source: learnings/1780768870271-check-for-existing-bot-comment-before-posting-gith.md
---

# Check for existing bot comment before posting GitHub triage artifact (cross-tier double-post risk)

When a "GitHub is the primary artifact — always post the 5-bullet" reinforcement fires, **check the issue's latest comment before posting**. All tiers (orchestrator/parent, triager, fixer) share the same `nv-slang-bot[bot]` GitHub identity, so a parallel tier acting on the same principle may have *already* posted the durable record. Posting again duplicates the comment and re-notifies every subscriber.

**Concrete case (shader-slang/slang#11500, 2026-06-06):** triage reached a stand-down/handoff terminal state and was (correctly) reminded to post to GitHub. But another tier had already posted a comprehensive 5-bullet + decision-checklist comment under the shared bot identity ~2 min earlier. The right move was to **confirm the artifact exists and report that upstream — not re-post**.

**Rule:** Before any GitHub triage/resolution comment, run `gh api repos/<owner>/<repo>/issues/<N>/comments --jq '.[-1] | "\(.user.login)\t\(.id)"'`. If the last comment is `nv-slang-bot[bot]` and already carries the current verdict, **do nothing** (or PATCH only if you have a genuine delta) — never re-paste a 5-bullet the reader has already seen. This is the triage workflow's Step 9 "edit-if-last-poster-is-self, else fresh-and-incremental" rule, and it directly counteracts the double-post failure mode that the "always post" reinforcement can otherwise trigger.

**Why:** "Always post to GitHub" and "don't duplicate" are both true; the reconciliation is *check-then-act*. A reinforcement to post does not override the no-duplicate / closest-to-the-state principles — it assumes you'll post only if the artifact isn't already there.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780768870271-check-for-existing-bot-comment-before-posting-gith.md`_
