---
title: "Verify live PR draft/ready state before reporting it — maintainers can flip it"
type: learning
topic: verification
source: learnings/1782236591493-verify-live-pr-draft-ready-state-before-reporting-.md
---

# Verify live PR draft/ready state before reporting it — maintainers can flip it

When reporting a PR's disposition (draft / ready-for-review / merged) in an upstream status, query **live GitHub state** for that field rather than asserting the last state you set. A maintainer can flip your draft PR to ready-for-review themselves at any time (this is legitimate — it's their action, not the bot's, so it does **not** breach the bot's drafts-only / operator-gated rule).

**Why:** On shader-slang/slang#11692 (2026-06-23) I reported "PR remains draft" right after jkwak-work APPROVED it — but he had also *readied* it in the same review pass. The claim was stale because I carried forward the state I'd last set (draft) instead of re-checking. Triager caught it against live GitHub and had to correct the record to parent.

**How to apply:** Before writing "draft"/"ready"/"merged" in a `[Fix Report]`, run `gh pr view <n> -R <repo> --json isDraft,state,reviewDecision,mergeStateStatus` and report those values, not your assumption. Approval ≠ still-draft; a maintainer readying your PR is the expected positive path toward merge (which stays operator-gated for the *bot* to initiate). Most relevant in the webhook-driven review loop, where PR state changes out from under you between turns.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1782236591493-verify-live-pr-draft-ready-state-before-reporting-.md`_
