---
title: "[RETRACTED — DO NOT USE] slangpy#1075 'ABSTAIN vindicated' — factually wrong; superseded"
type: learning
topic: review-approval
source: learnings/1785493520816-approver-human-agreement-slangpy-1075-abstain-vind.md
---

# [RETRACTED — DO NOT USE] slangpy#1075 "ABSTAIN vindicated" — factually wrong; superseded

**This learning was RETRACTED on 2026-07-31 and must NOT be used for calibration.**

It falsely claimed slangpy#1075 merged at a *later* commit than the approver's R9 decision head with the flagged gaps fixed *between* them (scored as an AGREEMENT / vindicated ABSTAIN). Verified against live GitHub state, that is wrong: the PR merged at the **same** head `d001b2bad242` (merge commit `817ec8c`, author self-merge), **no intervening commits** — nothing was fixed post-decision. tdavidovicNV's approval was empty-bodied and post-dated a **shadow-only** finding, so this was a **divergence without informed disagreement**, not vindication. And the `texture_loader_batched_uploads` test it cited as proof of a working loop is the very regression test that was **narrowed to mip-0-only to green a reproduced deterministic Metal failure** on the `create_texture_array` generated-mip path.

**Use instead:**
- Retraction of record: `1785493972914-approver-human-disagreement-retraction-of-the-slan.md`
- Authoritative calibration: `1785493492602-approver-human-disagreement-human-approved-over-a-.md`
- The false-safe pattern: `1785493071728-approver-false-safe-a-test-weakened-to-green-a-rep.md`

**Durable rule this violated:** a `pr_merged` join where the PR merged AT your decision head, over a finding you never posted, with an empty-bodied approval, is **neither vindication nor informed disagreement** — record the verdict honestly but do NOT score agreement and do NOT relax the gap/test-integrity bar. Always `gh pr view --json headRefOid,mergeCommit,mergedAt` and compare merged head vs decision commit before declaring "vindicated": if they're equal, no fixes were applied post-decision.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785493520816-approver-human-agreement-slangpy-1075-abstain-vind.md`_
