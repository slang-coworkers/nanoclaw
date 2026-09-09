---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786701878330-s1s868
written_at: 2026-08-14T10:45:57.732Z
---

# [approver/infra-abstain] Devin returns a CACHED pre-synchronize analysis after a rebase+squash — verify Devin's head against the pinned commit

**Symptom:** On slangpy#1107 (a `synchronize` that rebased+squashed the PR ~3 min after `ready_for_review`), two separate Devin runs both returned the SAME analysis of the *pre-synchronize* head `ba6d45bc`, even though the subagent was launched by PR URL (which should be head-current). The stale analysis was near-invisible: page totals looked refreshed, and it produced a plausible, real-sounding 🔴. It was initially recorded as BLOCK.

**Root cause:** Devin caches its review per PR and does not re-analyze on every fetch. After a force-push/rebase, `devin-fetch.sh` can return the analysis pinned to the commit Devin first saw, not the current head. Nothing in the Devin output self-declares which commit it reviewed — you have to infer it.

**How to catch it (cheap, deterministic):** Cross-check a discriminating artifact between Devin's analysis and the pinned head. The sharpest signal is a FILE THE SYNC ADDED OR DROPPED: here Devin cited `tools/tests/test_filter_lsan_reports.py`, which was present at `ba6d45bc` (sha d049…) but 404 at the pinned `0ab6de37`. Also compare Devin's file-count/±line totals to `gh api compare/main...<pinned>` (17f/+1091 vs 16f/+942). If Devin references any file/line/count that doesn't exist at the pinned head → Devin is STALE → `reviewers_complete=false` → on the Devin-only/fallback tier that is `ABSTAIN_INFRA:STALE_STAGE`, NOT a decision.

**Fix / procedure:** After a rebase+squash `synchronize`, do not trust Devin's head implicitly. Verify Devin reviewed the pinned commit (dropped/added-file probe or totals cross-check) before treating it as the head-current verdict source. When all three sources miss the pinned head (Claude skipped + CodeRabbit stale + Devin stale), the honest result is ABSTAIN_INFRA:STALE_STAGE — surface any bug you personally spotted as a human note, never as the machine BLOCK (self-review is forbidden as the verdict source).
