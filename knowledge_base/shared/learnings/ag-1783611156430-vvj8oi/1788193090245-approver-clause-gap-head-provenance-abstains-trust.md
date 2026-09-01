---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788192478820-emc007
written_at: 2026-08-31T16:18:10.245Z
---

# [approver/clause-gap] head_provenance abstains trusted-MEMBER fork PRs; still do a lightweight challenger read to enrich the handoff

**Context:** shader-slang/slang#12844 @ bd59ffa93b5f (Metal nested-existential layout fix), decided 2026-08-31.

**Symptom:** A PR authored by a repo MEMBER (`author_trust` PASS) still resolved to ABSTAIN_POLICY because `head_provenance` FAILed — the head branch lived on the author's fork (`fknfilewalker/slang`), and policy v0-shadow forbids fork heads for auto-approval. `author_trust` does NOT override `head_provenance`; they are independent clauses. Practical consequence: under v0-shadow, essentially every community/fork PR auto-abstains at Step 1 even from trusted authors, and the Step-3 challenger never runs (it runs only if Steps 1–2 pass).

**Root cause:** `eval-clauses.py` reads PR metadata `isCrossRepository`/headRepositoryOwner. A cross-repo head fails the provenance clause by design (a fork head can diverge from what CI validated / supply-chain caution). This is working-as-intended, not a bug — but its breadth is easy to mis-read as "the code was rejected." The reason_code CLAUSE_FAIL:head_provenance is a POLICY abstain (a human must look), NOT infra — it does not count toward the infra gate.

**How to catch it:** When `head_provenance` is the sole/decisive FAIL, don't stop at the bare clause result. The human who picks up the fork-head PR benefits from the substantive signal you'd otherwise have produced. Do a cheap challenger-style read anyway and record it in `record_decision`'s `challenger` field (marked `reached:false`, with a `preempted_observation`). On #12844 that surfaced the real finding: the PR's core Metal deliverable (`legalizeVectorPointerBitCast`) has NO CI-runnable coverage — both `-metal` lines need a device and are skipped in Linux CI (the "Metal green CI != Metal ran" false-safe), while the layout fix itself IS covered by the -cpu/-vk/-cuda lines. A compile-only `-target metal` FileCheck test would close it. (Code itself was sound: uint2 swizzle/pack pairing correct; the bit-cast legalization is a fixed-point single pass — CodeRabbit's "nested casts not traversed" Major was refuted by the author's reply and by reading the containment-tree walk in processInst; Devin clean.)

**Fix / takeaway:** (1) Treat author_trust and head_provenance as orthogonal — a trusted author on a fork still abstains. (2) Even on a Step-1 clause-fail abstain, spend the few minutes to read the diff and stash a `preempted_observation` in the challenger field so the fork-head handoff carries the real coverage/correctness signal, not just "fork head forbidden." (3) The synthesis is still worth completing so `commit_match` evaluates (otherwise it reports unevaluable and adds spurious CLAUSE_UNEVALUABLE noise to the recorded clauses).
