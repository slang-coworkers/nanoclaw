---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787733696721-4ome3z
written_at: 2026-08-26T14:28:06.474Z
---

# [approver/human-agreement] Safe-shape checklist for a CI workflow-split/refactor PR

**Signal:** slang #12767 ("ci: give test-falcor-perf its own build dependency") — a pure `.github/workflows` refactor that split a job into its own reusable workflow and re-wired its `needs:`. Decided WOULD_APPROVE; MERGED AS-IS at my exact decided head `6951b0e685bd` (0 interval commits) with an explicit human MEMBER APPROVE at head. Full agreement, no false-safe.

**Transferable class — a CI workflow-refactor of this shape is safe to WOULD_APPROVE when ALL hold:**
1. **The moved/renamed job body is a VERBATIM move.** Diff the new reusable-workflow job against the old inline one: only difference should be a value hoisted to a `workflow_call` input whose DEFAULT equals the old hardcoded literal (here: download-artifact `name:` → `${{ inputs.slang-artifact-name }}`, default = the old string). Behavior unchanged ⇒ no functional risk.
2. **The new `needs:` edge matches the artifact/dep the job actually CONSUMES.** Read `ci.yml` at head: the caller must depend on the job that PRODUCES the artifact it downloads (here `build-windows-release-cl-x86_64-gpu` produces `slang-tests-windows-x86_64-cl-release`), not a coincidentally-similar one. A `needs:`-race fix is exactly this: the edge that was missing.
3. **LIVE-GATE positive control (the decisive one for any scheduling-YAML change):** if the PR wires the job into an aggregate required gate (`check-ci`'s `needs:`), verify on the PINNED HEAD via `commits/<sha>/check-runs` that the new job's check-run actually RAN and concluded `success`, AND the aggregate gate is green WITH it in its needs list. "green ≠ ran" — a scheduling-YAML edit can silently skip a job; a trigger-present success run refutes the dead/skipped-gate concern directly.
4. **Supply-chain scrutiny (`.github/workflows/**` is a supply-chain surface — the v0-shadow-wide policy comment flags it for re-tightening at enforcement):** actions pinned to full SHAs; `persist-credentials:false`; minimal `read` permissions; NO `pull_request_target`; env vars fed from org-controlled action outputs, not attacker-controlled PR input; `set -euo pipefail` + quoting in run steps. A move introduces none of these if they weren't already present.
5. **Bot signals consistent:** production Claude review LEGITIMATELY skips workflow-only PRs (harvest exit 20 is expected, not an infra defect) ⇒ fallback tier; CodeRabbit clean + Devin exit0 clean is sufficient corroboration when 1-4 verify from source.

**Non-blocker seen here:** the author's added `ci.yml` comment carried some change-history narration ("previously had no needs:…"). That is an inert code-comment-prose nit — no functional trigger/blast-radius/purpose-undermining — so it CLEARS as advisory under Step-3, NOT an OPEN_GAP. Do not let a code-author linting standard drag a verified CI-refactor approval down to ABSTAIN (see the companion [approver/critique-mustfix] on OUTPUT_REVIEW oscillation).
