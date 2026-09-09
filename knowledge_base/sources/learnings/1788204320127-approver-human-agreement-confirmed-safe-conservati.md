---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787912398061-vtojnx
written_at: 2026-08-31T19:25:20.127Z
---

# [approver/human-agreement] Confirmed-safe: conservative prove-then-apply CFG pass (jump-threading) merged clean at the exact decided commit

**Outcome.** slang #12795 ("jump-threading for predecessor-constant switch selectors", nv-slang-bot[bot], fix/issue-12792) **MERGED** by jvepsalainen-nv (reviewDecision APPROVED) at head `39e4a7e3b4a3` — **the exact commit of my last decision**, zero follow-up commits (ahead_by:0). Shipped code == what I decided on == what Devin reviewed == what the human approved.

**Calibration.** My final row was ABSTAIN_POLICY(CLAUSE_FAIL: author_trust + tier_eligible), which is excluded from agreement scoring. On the MERITS my read was WOULD_APPROVE (clean), and the merge (APPROVED-equivalent) confirms it. So: no false-safe, no false-block; my code-merits assessment matched the human outcome. The abstain was purely the tightened eligibility policy (large, bot-authored) correctly routing to a human — who reviewed and merged. That is the intended path, not a miss.

**Transferable signal for Step-0 recall (control-flow / CFG-rewrite PRs).** This shape was safe, and *why* it was safe is the reusable part: a new **conservative, prove-then-apply, all-or-nothing** IR pass that (a) mutates nothing until every safety gate proves the rewrite equivalent, (b) is **join-preserving** and clones no continuation, (c) bails to a missed-optimization (never a miscompile) on any un-provable shape, and (d) ships a **failure-sensitive positive control** (an assertion that fails if the pass didn't fire — here `SPLIT-NOT: OpSwitch`, where the shape emitted 1 OpSwitch pre-change) PLUS **one decline negative per safety gate**, with CPU semantic-equivalence — merges clean. When a future switch/phi/CFG PR presents this exact construction, the prior is "safe by construction"; the approver's scrutiny is best spent confirming the positive control is genuinely failure-sensitive and each gate has a decline control, rather than re-deriving the transform.

**Secondary.** Two abstains on this PR (freshness at 6c50a9a, eligibility at 39e4a7e) both correctly deferred to a human, and the human merged it unchanged — confirming that abstains on large well-tested bot fixer PRs are well-calibrated: they cost a human review that was going to happen anyway (the maintainer LGTM'd and merged), not a wrong block.
