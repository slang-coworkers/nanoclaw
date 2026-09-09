---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787850714786-bwcd1e
written_at: 2026-08-27T19:20:02.358Z
---

# [approver/confirmed] CI-YAML template-injection hardening (harvest exit 20 + Devin clean) is safe to WOULD_APPROVE when intent is genuine

**Symptom / setup:** slang#12804 hardened `.github/workflows/ci-slang-build.yml` against GitHub Actions template injection (moved `${{ inputs.* }}` out of `run:` scripts into step-level `env:` read as `$INPUT_*`). Single file, +27/-11. Surface signal was the classic "slides toward approval" trap: harvest exit 20 (no `github-actions[bot]`/CodeRabbit review — CodeRabbit auto-skips workflow-file PRs) + Devin clean. Decided WOULD_APPROVE @963745b1776d. **Outcome: merged unchanged at that exact commit (0 interval commits) — clean agreement.**

**Root cause / lesson:** This is the *complementary* datapoint to the existing `[approver/confirmed] DO-NOT-MERGE / CI-YAML → ABSTAIN` learning (a repro PR of the same class that closed unmerged). Together they pin the actual disambiguator for a CI-YAML PR carrying harvest-exit-20 + clean Devin: **it is intent/effect, NOT the bot signal.** A genuine hardening (`Fixes #<issue>`, no DO-NOT-MERGE/repro label, body motivates a real fix) merges; a repro/DO-NOT-MERGE PR of the identical bot-signal shape does not. Do not treat harvest-exit-20 as suspect on its own.

**How to catch / probe (what actually carried the WOULD_APPROVE, and is reusable):** For a workflow-injection hardening PR, the load-bearing check is a static scan of *every* `run:` block at the pinned head for residual `${{ }}` — a partial hardening (any interpolation left in an executable line) is the false-safe. Confirm: (1) zero `${{ }}` in any executable script line (comment lines are fine — bash never sees them); (2) all introduced `$INPUT_*` env vars are actually referenced (no dead/missing var) and no bare `inputs.` remains in script bodies; (3) rewrite is behavior-preserving — `[[ =~ "x" ]]` keeps its quoted (literal-match) RHS, and any now-shell `$VAR` in a cmake/CLI arg is quoted to prevent word-splitting (no-op for boolean values); (4) `INPUT_*` naming avoids shadowing real env vars (`OS`=`Windows_NT` on Windows runners); (5) no `on:`/`if:`/job-structure change → no CI coverage regression. Do NOT rest on green CI (a green run never proves the changed `run:` steps behave correctly — see `[approver/challenger-miss]` on this same file).

**Fix / calibration:** CI-YAML hardening of this shape, verified complete + behavior-preserving + genuine-intent, is a correct WOULD_APPROVE. Merged clean at the decided head confirms the static-scan probe is sufficient signal for this PR class; the clean-bot absence is expected, not a red flag.
