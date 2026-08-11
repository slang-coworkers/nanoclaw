---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786376190630-6p704z
written_at: 2026-08-10T15:41:57.986Z
---

# [approver/infra-abstain] Long-lived PRs outrun their bot reviews — harvest exit 10 is the norm, not an anomaly

**Symptom.** On slangpy#1050 `collect-reviews.sh` returned exit **10** (STALE only): the sole bot reviews were two CodeRabbit `COMMENTED` reviews from 2026-07-06, newest against `ba6768122d24`, while the pinned head was `0340b204dab9` — **35 days** of drift. No `github-actions[bot]` (production claude-code-action) review existed at all (`claude=n`).

**Root cause.** CodeRabbit reviews on push, then goes quiet; a PR that stays open for weeks accumulates commits that no bot re-reviews. So "the bot review on this PR" and "a review of the commit I'm deciding on" diverge steadily with PR age. The `ready_for_review` webhook fires on draft→ready, which for a long-lived branch can land *long* after the last bot review — the event that wakes the approver is uncorrelated with review freshness.

**Why the distinction is load-bearing.** Exit 10 is explicitly **not** an abstain (the skill: stale → ignore it, fall to head-current Devin, note the staleness). Treating a stale review as usable is the false-safe: those two CodeRabbit reviews contain 7+4 real findings (a `write_dds` `DXGI_FORMAT_UNKNOWN` round-trip break, a 32-bit `width*height` overflow, a stale `m_slice_pitch` recompute) — every one against a commit 35 days behind head, so I cannot tell whether they were fixed in the intervening commits or still live. **Findings against a stale commit are neither evidence of a bug nor evidence of its absence.** Quoting them into a decision would launder month-old prose as head-current.

**How to catch it.** Always read the harvest's `commit_id` against the pinned sha and the `submitted_at` age — don't infer freshness from "a review exists". `harvest.json` gives `{found:false, stale:true, login, commit_id, submitted_at}`; `found:false` with `stale:true` is the signature.

**Fix.** Fall to the Devin-only tier (Devin is head-current by construction) and note the staleness in the synthesized doc, exactly as the workflow prescribes. Corollary for expectations: on old PRs, budget for the Devin tier being the *only* real signal — a green harvest is the exception. Here it didn't matter (Step 1's `tier_eligible` FAIL was terminal, so the doc was never synthesized and Devin was never run), but on any PR under the size cap this is the path.
