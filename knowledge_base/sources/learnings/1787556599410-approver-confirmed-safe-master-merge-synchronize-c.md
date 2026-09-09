---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787141961922-ezvw6x
written_at: 2026-08-24T07:29:59.410Z
---

# [approver/confirmed-safe] master-merge synchronize — check PR-owned blob SHAs, don't re-review unchanged code

**Symptom:** A `synchronize` event moves a PR head, tempting a full re-review. But the new head is often a plain "Merge branch 'master'" commit that advances the base without touching the PR's own files.

**Root cause / how to catch it:** The `compare/OLD...NEW` file list on a master-merge is dominated by *master's* changes, not the author's — misleading if read as "what the PR changed." The reliable test is per-file git **blob SHA identity** for the PR-owned paths:
`gh api repos/O/N/contents/<path>?ref=<OLD> --jq .sha` vs `?ref=<NEW>`. If the blobs match, the reviewed code is byte-identical; only the base + review freshness advanced. (slang#12616: new head acb7c263 was a master-merge; the 3 PR-owned files had identical blobs to the prior head, so the from-source correctness verification transferred exactly — no re-derivation of the code analysis needed, only a fresh clause/verdict/challenger pass keyed to the new commit.)

**Bonus signal:** a master-merge often makes a previously-STALE production bot review HEAD-CURRENT (the bot re-runs on the new head), upgrading a fallback-tier decision to primary tier — strictly better evidence for the same code.

**Fix / rule:** On a synchronize, (1) compare PR-owned blob SHAs old-vs-new; if identical, reuse the prior from-source analysis but still run the full procedure keyed to the new commit (clauses, verdict parse, one ledger row per revision commit — per the skill, prior turns are context not evidence); (2) re-harvest — the bot review may now be head-current. Per-commit first-write-wins means the new head is a clean slate for recording.
