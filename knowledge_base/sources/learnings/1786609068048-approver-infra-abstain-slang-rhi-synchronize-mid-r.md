---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786606262420-ucgnlv
written_at: 2026-08-13T08:17:48.048Z
---

# [approver/infra-abstain] slang-rhi synchronize mid-review strands the head with NO head-current review signal → NO_REVIEW_SIGNAL, not WOULD_APPROVE

**PR:** shader-slang/slang-rhi#836 @ ab17a75317b6 ("Fix undefined behavior", skallweitNV). Decision: ABSTAIN_INFRA / NO_REVIEW_SIGNAL.

**Symptom:** A `synchronize` pushed a 3rd commit (PATCH 3/3, the ONLY commits touching production `src/`) after CodeRabbit had already reviewed the old head. At the new head: harvest exit 20 (`found:false`); the CodeRabbit summary comment's footer said it reviewed `base..d96813682114` (the OLD head — never covered PATCH 3/3); CodeRabbit's commit status at the new head was `success` with description **"Review rate limited"** (it did NOT re-review); Devin timed out (the norm on slang-rhi). So there was NO head-current bot review of the substantive commit.

**Root cause / trap:** The code changes were small, clean, maintainer-authored, and directionally correct on an independent trace (real null-deref UB guard; CPU unwrap-before-initBase brought CPU into line with the 6 other backends), and all 19 CI configs were green with real-device Unit Tests actually executed at the head. That combination is seductive — it makes WOULD_APPROVE feel obviously right. But the approval contract is explicit: `reviewers_complete = true` requires **a head-current bot review harvested OR Devin exit 0**. Neither held. The approver's own code reading + green CI are NOT a substitutable review signal — treating them as one is the self-review the hard rules forbid ("investigation can only add caution, never upgrade toward approval").

**How to catch it:** When harvest exits 10/20 (stale or no bot review) AND Devin failed/timed out, `reviewers_complete=false` is forced → Step 2 harness-integrity fail → ABSTAIN_INFRA:NO_REVIEW_SIGNAL. Do NOT let a clean self-trace or green CI flip `reviewers_complete` to true. Specifically: a CodeRabbit status of `success` at the head does NOT imply it reviewed the head — read the summary comment's `Commits`/footer range and compare its end sha to the pinned head; "Review rate limited" means it punted. A synchronize that lands the substantive commit AFTER the bot's last review is the classic strander.

**Fix:** Record ABSTAIN_INFRA:NO_REVIEW_SIGNAL with reviewers_complete=false. The change may well be fine — a human just has to look, because the review pipeline produced no head-current signal. This is a repo-shape hazard on slang-rhi (no production claude-code-action bot; CodeRabbit-primary + best-effort Devin), so it recurs whenever a PR is pushed-to during CodeRabbit's window and Devin doesn't complete.
