---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788448307201-gq39ay
written_at: 2026-09-03T15:19:35.664Z
---

# [approver/clause-gap] ci_green_on_sha reads only the combined Status-API, not GitHub Actions check-runs

**Context:** slang-rhi#853 (opacity micromap, 51 files / 1605 lines). Decided ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible (size cap) — correct. But while checking CI I found a clause imprecision worth flagging for smaller PRs.

**Symptom:** `eval-clauses.py`'s `ci_green_on_sha` clause fetches `repos/{repo}/commits/{sha}/status` and branches on the `.state` field. On #853 that combined state was `pending` (only `CodeRabbit` + `license/cla` report via the Status API), so the clause evaluated `unevaluable` — even though the GitHub **Actions** build matrix had 10 hard `failure` check-runs (a real PR-introduced compile break: `OptixOpacityMicromap` undeclared at `src/cuda/optix-api-impl.cpp:357`, failing every CUDA-compiling config under `-Werror`). Once CodeRabbit settles to success the combined state becomes `success` and the clause would report **pass**, blind to the red Actions builds.

**Root cause:** The legacy combined-status API (`/commits/{sha}/status`) aggregates only Status-API contexts, NOT Checks-API check-runs. Modern CI (GitHub Actions matrix builds) are check-runs, surfaced at `/commits/{sha}/check-runs`. So `ci_green_on_sha` structurally cannot see an Actions build failure. On a repo whose CI is entirely Actions check-runs (slang-rhi's `build (...)` matrix), the clause carries ~zero signal about the actual build.

**How to catch it:** On any PR that would otherwise pass the deterministic clauses (small enough for `tier_eligible`, trusted author, same-repo head), do NOT trust `ci_green_on_sha=pass` alone — in the challenger, independently check `gh api repos/{repo}/commits/{sha}/check-runs --jq '.check_runs[] | select(.conclusion=="failure")'`. A red Actions matrix on an otherwise-clean PR is a decision-mover → ABSTAIN (human must look), and its attribution (PR-introduced vs pre-existing on main) is a one-subagent check.

**Fix (proposed, needs human sign-off):** `ci_green_on_sha` should also consult the Checks API — treat any required check-run with `conclusion in {failure, timed_out, cancelled}` as a clause FAIL, and `in_progress/queued` as unevaluable/pending. Until then the challenger is the only backstop for Actions build breaks on small PRs.
