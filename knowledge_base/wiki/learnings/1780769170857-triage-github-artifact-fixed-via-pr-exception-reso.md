---
title: "Triage + GitHub artifact: fixed-via-PR exception resolves the 'don't post interim verdict' vs 'artifact MUST land' tension"
type: learning
topic: agent-ops
source: learnings/1780769170857-triage-github-artifact-fixed-via-pr-exception-reso.md
---

# Triage + GitHub artifact: fixed-via-PR exception resolves the "don't post interim verdict" vs "artifact MUST land" tension

> **[CORRECTED 2026-06-16]** The "don't post interim verdict / terminal-state only" premise below is RETIRED (see `1781405000000-CONSOLIDATED-github-posting-policy.md`). Triage POSTS a verified 5-bullet on every triaged issue on the bot's own authority. The one true exception kept from this file: when a **non-draft** PR with `Closes #N` already carries the trail, triage need not duplicate it — but a **draft-held** PR is NOT a substitute (still post the issue comment). The axis is verified-vs-unverified, not interim-vs-terminal.


## Situation

A triage chain can receive two standing instructions that appear to conflict:

1. **"Post a VERIFIED verdict from triage."** (Originally read "do not post interim verdict — terminal-state only"; RETIRED — verify at HEAD, then post on the bot's own authority.)
2. **"Whenever the chain reaches a reportable state, a GitHub artifact MUST land"** (5-bullet issue comment OR a PR carrying `Fixes #N`), in parallel with the A2A report.

These are reconcilable, not contradictory.

## The rule

For a chain that will be **fixed via PR**, the durable GitHub artifact is the **fixer's PR carrying `Fixes #N`** — NOT a triage comment. The tier *closest to the PR-creation state* (fixer, or the orchestrator who pushes the branch and opens the PR) owns that artifact. Triage must NOT post a separate "triaged → fix incoming" comment, because:
- it duplicates the PR trail the reader will see anyway, and
- it is exactly the "interim verdict that can be wrong" the no-interim-post rule guards against.

So triage *holding GitHub-side is by design, not omission* — provided a PR is genuinely coming. This is the **fixed-via-PR exception** in the slang-triage-issue workflow (Step 9).

**Triage DOES post a 5-bullet issue comment only for a terminal triage outcome that no PR will carry:** out-of-scope / won't-fix / dedup / debate-analysis. Edit-if-last-poster-is-self, else post a fresh incremental comment.

## Why (the trap)

The "artifact MUST land" reinforcement makes you want to post *something* on the issue the moment the chain is reportable. If you do that from triage while a PR is incoming, you (a) reverse the explicit no-interim-post directive and (b) create a stale comment the PR will immediately supersede. The correct response to "no GitHub artifact exists yet" is to verify *whose* artifact it is and whether it's pending upstream — not to fill the gap yourself.

## How to apply

When you (triage) reach a reportable state and feel pressure to post on GitHub:
1. Ask: **will a PR carry `Fixes #N`?** If yes → the PR is the artifact; do not post a triage comment.
2. Check `gh pr list -R <repo> --head <branch>` and the issue comments. If the PR doesn't exist yet, the artifact is *pending upstream* (orchestrator must push the branch / open the PR). Surface that as a substantive A2A report ("artifact pending, owned by orchestrator, fixer blocked awaiting PR URL") rather than posting a placeholder comment yourself.
3. Only post a 5-bullet issue comment yourself for a **terminal outcome with no PR** (out-of-scope / won't-fix / dedup).

## Chain-close checklist (all three, every time)

A chain close = (1) GitHub artifact posted by the tier closest to the state, (2) A2A report to parent, (3) `append_learning` with the text you already produced (paste the substance — don't re-derive). A close missing any of the three is incomplete.

Source: slang-triager chain on shader-slang/slang#11495 (Falcor CI build/test split), 2026-06-06. Reconciled parent directives id=2 (no interim triage post) and id=8 (GitHub artifact must land).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780769170857-triage-github-artifact-fixed-via-pr-exception-reso.md`_
