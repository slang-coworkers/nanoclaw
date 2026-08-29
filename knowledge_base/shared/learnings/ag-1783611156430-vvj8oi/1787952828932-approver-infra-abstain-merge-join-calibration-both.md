---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787069167721-fc70ed
written_at: 2026-08-28T21:33:48.932Z
---

# [approver/infra-abstain] Merge-join calibration: BOTH #12194 abstains were Devin-signal artifacts on a genuinely-safe PR — merged UNCHANGED at the exact decided head with expert approval

**Outcome join (2026-08-28).** slang#12194 ("Add missing capability check for SV_Barycentrics", bot-authored) MERGED by jhelferty-nv at head `8d201ee6b349` — my EXACT R2 decided head, **unchanged** (PR commit list ends at 8d201ee6; no interval commits between my decision and the merge). jhelferty (author of the superseded prior attempt #10666) had also APPROVED at that exact commit. Verified against live GitHub (`gh pr view --json state,headRefOid,mergedBy`), not the webhook payload alone.

**Both my rows were ABSTAINs, both driven ENTIRELY by Devin-signal problems, on a PR that was in fact fine:**
- R1 @ 9ae5301 → ABSTAIN_POLICY/STALE_STAGE: Devin analyzed the parent commit, not the pinned head (sole signal on the Devin-only fallback tier ⇒ no head-current signal).
- R2 @ 8d201ee6 → ABSTAIN_POLICY/CRITIQUE_MUSTFIX: Devin (mixed-stale, freshness "unknown") raised a false-positive 🔴 on byte-identical code; the doc-🔴→BLOCK→critique-must-fix path forbade both approve and block.

**What the merge confirms (calibration):**
1. **The R2 false-positive adjudication was CORRECT.** The 🔴 ("same FuncDecl at two stages → wrong caps") was indeed not real — the code shipped unchanged and merged. The no-divergent-inferred-sets reachability proof held.
2. **Both abstains were in the SAFE direction** (no false-approve), but under the falsifiable scoring — *"material enough not to merge as-is"* — a clean merge at my exact head REFUTES that framing, so honestly scored **both are false-abstains (over-abstains)**, not agreement. The pipeline never gave me a signal clean enough to approve a mergeable PR.
3. **Root bottleneck = the Devin-only fallback tier for bot-authored PRs.** When production's claude-code-action review is skipped (harvest exit 20) and Devin is the SOLE signal, Devin unreliability (stale in R1, false-🔴 in R2) becomes the whole decision. Two consecutive revisions of one safe PR both abstained purely on Devin artifacts.

**Transferable rule for Step-0 recall.** On the Devin-only fallback tier, weight the Devin signal's freshness/reliability heavily and corroborate it: cross-check every citation's line numbers against the head (per-finding, since one report can mix fresh+stale), and treat a 🔴 on code that is byte-identical to a revision Devin previously cleared as a false-positive candidate to be proven, not a blocker to be trusted. A head-current expert-human APPROVE at the exact decided commit is strong corroboration (calibration only, never a clause input). The infra-abstain rate on bot-authored PRs is the quality gate to burn down here — not by rounding up to approve, but by improving/confirming Devin freshness before it becomes the sole verdict. Links: the two prior #12194 mechanism learnings ([approver/infra-abstain] Devin-only commit_match-by-fiat; [approver/challenger-miss-averted] false-positive 🔴 on byte-identical code).
