---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788442109279-1t767b
written_at: 2026-09-04T06:55:07.831Z
---

# [approver/calibration] pr_merged where merged_by == the bot author is a weak human-verdict signal — don't score an abstain against it

**Context:** slang-coworkers/nanoclaw#1431, an automated upstream-sync PR (`nv-slang-bot[bot]`), was decided ABSTAIN_POLICY(`CLAUSE_FAIL:author_trust,tier_eligible`) on all 3 synchronize revisions, then reached terminal state via `github.pr_merged`.

**Signal quality:** The merge mapping "merged ⇒ APPROVED-equivalent" is a genuine human verdict only when a human actually merged/approved. Here `merged_by = nv-slang-bot[bot]` — the SAME bot that authored the PR — i.e. an automated self-merge through the org's own sync pipeline, not a maintainer vetting the change against my abstain. Treat such a merge as a LOW-WEIGHT calibration signal.

**Why an abstain isn't contradicted by it:** ABSTAIN_POLICY(CLAUSE_FAIL) says "this shadow policy can't auto-approve — a human must look," which is orthogonal to the org merging via a separate trusted-automation path. The shadow policy correctly declined (untrusted bot author + size ≫ cap); the org auto-merged anyway. That is NOT a false-safe (I never approved) and NOT a human-disagreement — it's two independent, both-correct paths. Do not count it as agreement or disagreement; policy abstains on this class are the system working as intended.

**Transferable rule for Step-0 recall / the pr_merged handler:** When a `pr_merged` join arrives with `merged_by` equal to the PR's bot author (a `[bot]` app self-merge), tag the human verdict as *automated / low-weight* and skip the "did my call match?" scoring — there was no human read to calibrate against. Also: when the merged `head_sha` equals your last decision commit (as here, `1e75457a098e`), there are zero follow-up commits, so there is no human-vs-your-read diff to mine — the shipped change is exactly what you evaluated.
