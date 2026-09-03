---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788288943993-p7rzir
written_at: 2026-09-02T21:36:27.787Z
---

# [approver/calibration] MEMBER-authored .github/** CI PRs over v0-shadow caps merge unchanged — abstain is deliberate scope, a widening candidate

## [approver/calibration] Merge-outcome confirmation: trusted-author `.github/**` automation PRs merge clean

**Signal (shader-slang/slang#12854, "Onboard new issues onto Slang-All with Source classification"):**
- Decision @ `5af633ff55bd` (head, reason=synchronize): **ABSTAIN_POLICY**, reason `CLAUSE_FAIL:no_protected_paths` (+ `tier_eligible` 686 > 400 cap). policy=v0-shadow, mode=live.
- Human outcome (pr_merged join): **MERGED unchanged by the author jhelferty-nv (a MEMBER) at the exact decision commit** — 2 commits total, last commit == decision commit, zero follow-up commits between my read and the shipped change.

**What it confirms (not a miss):**
- The abstain was a hard *scripted-clause* fail (protected paths + size cap), NOT an over-conservative judgment call. Abstains are excluded from agreement scoring, so there is no false-safe here — I made no positive claim; the policy correctly routed a `.github/**` PR to a human, and a trusted human merged it.
- This is the shape flagged in prior learnings: MEMBER-authored, same-repo, CI-green `.github/**` automation PR (workflows + JS test files + README). It merged clean and unchanged. Combined with the "CI-YAML PRs merge fine is expected" and "write-tier-only escalation is a WEAK OPEN_GAP for slang maintainers" atoms, this is another data point that **this whole class ships fine**.

**Transferable takeaway:**
- When you see (a) author_association ∈ {MEMBER,OWNER,COLLABORATOR}, (b) same-repo head, (c) CI green, (d) changes confined to `.github/**` automation/config, expect an ABSTAIN under v0-shadow purely from `no_protected_paths` (and often `tier_eligible` — these PRs are frequently large). Record it honestly; do NOT try to reason your way to WOULD_APPROVE around a scripted clause fail, and do NOT re-escalate the policy mount per-PR (that's one standing operator escalation).
- The accumulating merge-clean record for this class is exactly the evidence a human would use to justify **widening the policy** (e.g. per-trusted-author relaxation of `protected_paths`/`max_total_lines`). That is a human-gated policy decision — the approver's job is to keep feeding the calibration signal, not to widen scope itself.

**How to catch / act:** On a pr_merged join where merged head == decision commit and decision was ABSTAIN_POLICY:CLAUSE_FAIL on a trusted-author config PR → this is a confirming (not corrective) signal; a short calibration atom like this is the right output, no learning-as-fix required.
