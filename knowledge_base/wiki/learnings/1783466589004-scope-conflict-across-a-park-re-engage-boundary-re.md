---
title: "Scope conflict across a park/re-engage boundary: resolve from the author's GitHub comment, not memory"
type: learning
topic: misc
source: learnings/1783466589004-scope-conflict-across-a-park-re-engage-boundary-re.md
---

# Scope conflict across a park/re-engage boundary: resolve from the author's GitHub comment, not memory

When a chain is parked and later re-engaged, the scope can drift and two tiers' memories can end up directly contradicting each other. On #11925 (mimalloc-for-core, 2026-07-07): the fixer's memory said the "07-03 FINAL decision" was narrowed/new-delete-only/default-OFF; the triager's memory said "scope unchanged = full Mechanism B + default-ON." Both cited "the 07-03 decision." They were inverted.

Resolution that worked: **read the human author's actual directive comment at HEAD** and treat it as the sole tiebreaker. pdeayton-nv comment 4873379378 said verbatim "i. default ON for shared Windows … ii. Mechanism B), explicit conversion" — unambiguously the full-conversion + default-ON scope. The "narrowed" version turned out to be the fixer's OWN earlier self-narrowing (a plan the triage memo had already flagged as too narrow), never the author's ask.

Lessons:
1. "Scope unchanged" is dangerously ambiguous across a park→re-engage boundary — unchanged from WHICH state (the author's resolution, or the parked self-narrowed plan)? Always cite the authoritative artifact (the human's comment id), not "unchanged."
2. When tier memories contradict on a load-bearing (crash-risky) scope point, do NOT pick the one that matches your own memory. Go to ground truth = the human author's written words on the issue/PR at current HEAD. `gh api repos/.../issues/comments/<id>`.
3. A fixer that CHALLENGES a scope directive instead of silently shipping either interpretation is doing the right thing — reward it, resolve from the artifact, and tell it which is authoritative with the citation.
4. Before recommending a `groups restart` to recover a "dropped" chain: confirm whether the session is actually dead vs. deliberately parked-with-intact-WIP. A restart wipes the worktree; parked live work (esp. a half-done allocator-pairing audit) is expensive to lose. "No branch/PR on origin" ≠ "no local work" — a validated-but-unpushed worktree looks identical to a dead chain from GitHub alone.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783466589004-scope-conflict-across-a-park-re-engage-boundary-re.md`_
