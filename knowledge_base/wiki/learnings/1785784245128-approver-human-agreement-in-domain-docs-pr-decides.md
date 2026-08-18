---
title: "[approver/human-agreement] in-domain docs PR decides on MERITS — OUT_OF_SCOPE is a REPO-class predicate, not a 'diff is docs' predicate"
type: learning
topic: review-approval
source: learnings/1785784245128-approver-human-agreement-in-domain-docs-pr-decides.md
---

# [approver/human-agreement] in-domain docs PR decides on MERITS — OUT_OF_SCOPE is a REPO-class predicate, not a "diff is docs" predicate

**Symptom:** slang-rhi#806 — one-line README license correction ("MIT" → "Apache 2.0 with LLVM Exception"), bot-authored by `nv-slang-bot[bot]` on `fix/issue-805`, harvest exit 20 (`{found:false}`), all 6 clauses PASS. That combination is byte-for-byte the shape that previously fired `ABSTAIN_POLICY:OUT_OF_SCOPE:<docs-class>` (nanoclaw #1007 changelog, website #204/#207/#208/#209, neural-shading #15). Recall surfaced those precedents and the pull toward "docs-only ⇒ OUT_OF_SCOPE" was strong.

**Root cause of the near-miss:** I was about to generalize the wrong feature. Reading the precedent atoms instead of the index summary showed every OUT_OF_SCOPE row fired on **repo-class** (non-compiler repo: `slang-coworkers/nanoclaw`, `shader-slang.github.io`, course materials) or on **conflict of interest** (#982, the approver's own harness). *None* fired on "the diff happens to be docs." `shader-slang/slang-rhi` is in-domain across ~8 prior rows, and in-domain docs-shaped PRs were decided on merits both directions: **#12082** (slang README glossary) → WOULD_APPROVE; **#12090** (README inconsistency) → ABSTAIN on a merits `OPEN_GAP`. So a docs-class abstain here would have invented a new predicate that precedent contradicts.

**How to catch it:** Ask "which feature actually fired in the precedent?" — repo identity, or diff content? Grep the precedent atoms for the *predicate*, not the outcome. A cheap discriminator: if the repo appears in prior in-domain decided rows, the docs-ness of the diff is not a scope question; it's a merits question about a small diff.

**The merits bar for a docs-of-record claim (what made WOULD_APPROVE legitimate rather than a round-up):** the standing instruction forbids rounding up on "one docs line + a maintainer approved it," and a license statement is a *checkable factual assertion*, so check it:
1. **Two independent authoritative sources**, not one — `LICENSE:1` SPDX id *and* `.reuse/dep5` blanket `Files: *`. Either alone is a single point of failure.
2. **Verify the fix DIRECTION, not just the value** — `commits?path=LICENSE` showed exactly 2 commits (initial MIT → #111 `bc7657abfac8` Apache, 2024-11-21), proving README was the stale artifact rather than LICENSE. Correcting docs→LICENSE is the right layer; reverting a shipped relicense would be a maintainer/legal call the PR correctly declined.
3. **Read the WHOLE file, not the diff** — this is the #12090 failure mode: an untouched line elsewhere contradicting the edit. Here line 14 was the only self-referential license statement; README:18-26 are per-*dependency* claims, a different kind of statement that cannot contradict the project-level one.
4. **Tree-grep for surviving stale self-claims, with a live control** — and probe *manifests* (json/toml/cmake/yml) separately, since a prose grep for "MIT license" misses `"license": "MIT"`.

**Join:** merged @exact head (squash-only ⇒ scored off `head.sha`, never ancestry); skallweitNV (MEMBER, non-self vs the bot author) APPROVED with `commit_id` == head. Human outcome agrees.

**Fix:** OUT_OF_SCOPE class families remain repo/COI-scoped: `website-content`, `course-materials-docs`, `approver-harness`, `nanoclaw-changelog-docs`. Do **not** add a bare "docs" family — in-domain docs PRs decide on merits.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785784245128-approver-human-agreement-in-domain-docs-pr-decides.md`_
