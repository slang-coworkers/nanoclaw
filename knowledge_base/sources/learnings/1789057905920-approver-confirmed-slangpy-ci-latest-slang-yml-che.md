---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1789057419305-qz3ml4
written_at: 2026-09-10T16:31:45.920Z
---

# [approver/confirmed] slangpy ci-latest-slang.yml cherry-pick-step PRs: Devin-only (harvest exit 20) + policy-abstain on protected path

## Symptom / class
Third confirmed instance (after slangpy#1145) of the same class: a PR whose ONLY
change is to the "Cherry-pick SlangPy PR" step in `.github/workflows/ci-latest-slang.yml`.
slangpy#1147 (jkwak-work, "Keep the cherry-pick fetches out of the submodules") added
`--no-recurse-submodules` to the two `git fetch` calls (`--unshallow` fetch + the
`pull/<pr>/head` fetch), +8/−2, one file.

## What to expect on this class (compounding data for Step-0 recall)
- **Harvest returns exit 20 (Devin-only tier), not a bot-review harvest.** Production
  `github-actions[bot]` posts NO review on these, and CodeRabbit posts only a *commit
  status* (`CodeRabbit success`) with no review body — so `collect-reviews.sh` finds
  nothing harvestable and no bot pending. Do NOT treat exit 20 here as a defect;
  synthesize the Devin-only doc. Devin ran clean (0 bugs/flags/info) and corroborated
  the fix as correct-scope.
- **Decision is fixed at Step 1, independent of any review verdict:** under
  `v0-shadow-wide-r2` (`protected_paths: [".github/workflows/**"]`), `no_protected_paths`
  FAILs → `ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths`. Clean POLICY abstain
  (human-must-look by design), NOT infra — does not burn the infra gate.
- **`--no-recurse-submodules` is a "narrow existing step"**, not a new flag/gate: it
  fails loudly when triggered and `--unshallow` is preserved, so the both-directions /
  positive-control challenger probe is N/A here (demanding it would false-abstain).
  Matches the #1145 caveat: distinguish "port/narrow existing behavior" (no control
  needed) from "new flag + new gate" (needs a setter + both-directions control).

## Discipline that held
Read the LIVE policy_version off the mount (`/workspace/extra/approver-policy/`,
`v0-shadow-wide-r2`) and let `eval-clauses.py` decide the protected-path clause —
never hand-judge `.github/**` status from recall (it flips between policy versions).
Building the Devin-only doc first (commit_id = commit_sha) kept `commit_match` a clean
pass, so the sole abstain reason is the protected-path FAIL, not a self-inflicted
CLAUSE_UNEVALUABLE:commit_match.

## Note
PR was already MERGED when the ready_for_review dispatch arrived; an ABSTAIN doesn't
assert about the code, so a merged-⇒-approved join is not a false-safe. Deferred the
human-verdict join to an actual routed `github.pr_merged` event per the skill.
