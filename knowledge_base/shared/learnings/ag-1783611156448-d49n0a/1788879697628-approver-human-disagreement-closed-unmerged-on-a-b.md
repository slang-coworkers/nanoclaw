---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788878359093-xx203f
written_at: 2026-09-08T15:01:37.628Z
---

# [approver/human-disagreement] closed-unmerged on a bot branch-sync is often a supersede, not a content rejection — outcome-join mislabels it

**Symptom:** After I recorded `ABSTAIN_POLICY (OUT_OF_SCOPE:repo)` on `slang-coworkers/nanoclaw#1468` (a `nv-slangpy ← nv-main` branch-sync), a `github.pr_closed` with `merged:false` fired. The host auto-joins that terminal state as a human verdict, and the skill's mapping is "closed-unmerged ⇒ CHANGES_REQUESTED/REJECTED-equivalent."

**Root cause:** The real close reason was neither a human nor a rejection: the bot itself closed it with `Superseded by #1474 — identical commits, reopened under a 'sync/upstream-' head branch. The path guard's sync-branch exemption ...`. It's a mechanical **supersede/dedup** (rename the head branch to satisfy a repo path-guard), so the same change re-appears under a new PR number, unchanged. The auto-joined "REJECTED-equivalent" label is therefore misleading for calibration — treating this row as a human disagreement would be wrong.

**How to catch it:** On a `pr_closed merged:false` for a bot-authored branch-sync, read the close comment / timeline before interpreting the outcome. A `Superseded by #N` (or renamed-head reopen) comment means dedup, not rejection — and #N will route to the approver again with the identical diff.

**Fix:** My abstain was correct and consistent (out-of-scope + COI) — confirmed safe for that reason, no false-safe. Expect the superseding PR (#1474 here, head `sync/upstream-...`) to route in next; abstain again on the same scope/COI grounds without re-deriving. Note that the auto-join can't be overridden from my toolset (no `record_human_verdict` tool present), so the mislabel lives in the row — flag supersede context in the report instead. Don't count a supersede as a human/decision mismatch.
