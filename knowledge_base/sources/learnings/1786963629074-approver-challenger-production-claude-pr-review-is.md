---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786961346824-tq15kj
written_at: 2026-08-17T10:47:09.074Z
---

# [approver/challenger] production Claude PR Review is paths-gated to compiler dirs — a PR touching only extras/** legitimately gets zero review run; fallback tier is correct, NOT the 12064 miss

# [approver/challenger] production `Claude PR Review` is `paths:`-gated — an `extras/**`-only PR gets no production review; fallback tier is correct

**PR:** shader-slang/slang#12572 @ cbb372b4eb88 — decided WOULD_APPROVE/CLEAN, mode=live. +2/-2 in `extras/ci/analytics/ci_health.py` (appends `/files` to pending-approval PR links in both render paths). Harvest returned `claude=n` (no `github-actions[bot]` primary); CodeRabbit ⚪ Minimal + 1 trivial nit; Devin exit 0, 0 bugs/0 flags. Fallback tier.

**Symptom / trap:** harvest `claude=n` on a non-draft, human-authored PR looks like it *could* be the slang#12064 miss (discarding a pending/primary review by falling to fallback too early). And the head's check-runs show `Claude Code Assistant | completed | skipped` (twice) — which learning `1784126153691` warns is NOT the production review job, so seeing it must not be used to conclude "production skipped."

**Root cause (the confirming mechanism):** the production review workflow `.github/workflows/claude-pr-review.yml` has a `pull_request_target` **`paths:` allow-list**: `source/** tests/** prelude/** include/** tools/** CMakeLists.txt cmake/** docs/**`. A PR whose entire diff is outside those globs (here `extras/ci/analytics/ci_health.py` — `extras/**` is NOT listed) **never triggers a `Claude PR Review` run at all**. This is structurally distinct from the job's `if:` skip (draft / `[bot]` / `claude/*` branch) and from the unrelated mention-triggered `Claude Code Assistant` check-run. So `claude=n` here is an *expected path-filter skip*, and the fallback tier (CodeRabbit + Devin) is the correct, complete signal — not an infra abstain, not a premature fall-through.

**How to confirm (transferable check, do this before trusting fallback tier on any harvest `claude=n`):**
1. `gh run list --repo <r> --workflow="Claude PR Review" --limit 10 --json databaseId,headSha,status,conclusion,event` and filter to the pinned head. **Zero runs keyed to the head** ⇒ never triggered (path/`if` filtered), NOT pending.
2. Read the workflow `paths:` block at the pinned ref and check the PR's changed paths (`gh pr diff --name-only`) against those globs. No overlap ⇒ legitimately skipped by design.
3. Contrast with the exit-22 pending race (slang#12064): there a run EXISTS and is `in_progress` — you must WAIT and re-harvest. Never-triggered (no run) vs pending (a run exists, mid-flight) are different states; only the latter risks discarding a primary signal.

**Rule:** On harvest `claude=n`, before deciding from fallback, distinguish *never-triggered* (paths/`if`-filtered → fallback is correct) from *pending* (a `Claude PR Review` run exists and is in_progress → wait). Resolve it by listing the workflow's runs for the head, not by reading check-runs on the commit. For PRs touching only `extras/**`, `.github/**`, or other non-listed dirs, the production review is expected to be absent and the fallback tier is the right call.
