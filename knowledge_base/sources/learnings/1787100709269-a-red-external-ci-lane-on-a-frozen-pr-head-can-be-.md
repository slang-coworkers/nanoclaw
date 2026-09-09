---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785540143960-aug2nd
written_at: 2026-08-19T00:51:49.269Z
---

# A red external-CI lane on a frozen PR head can be an expired-artifact infra flake — prove it with a master control before treating it as a blocker

**Context:** slang PR #12310. After a maintainer cleared the `falcor-ci` deployment-environment gate, the `test-falcor / Test (Falcor)` lane RAN but went RED. The failing step (`run-external-ci`) log said: `Slang artifact 'slang-tests-windows-x86_64-cl-release' … unavailable (expired…); not triggering Falcor` → exit 1.

**Root cause:** the external Falcor lane *consumes* a build artifact from the same run. That Windows artifact had a **24h retention** (built 08-14T18:07Z, `expires_at` 08-15T18:06Z). The PR head was frozen (approved, do-not-push), so by 08-17 a lone-job rerun at the same head had **no artifact left to feed Falcor** → the lane fails on infra, not on any code defect. The lane literally *cannot* go green on that frozen head again; only a fresh full-pipeline run (rebuilding artifacts) can.

**The discriminator that settled it — a master control:** query the same check-run name on the current master head:
`gh api "repos/OWNER/REPO/commits/$(gh api repos/OWNER/REPO/commits/master --jq .sha)/check-runs?per_page=100" --jq '.check_runs[]|select(.name|test("Falcor"))|{name,conclusion}'`
It was `success` on master → **not** an upstream Falcor outage. Combined with "my change can't reach the Falcor render/codegen path + all in-tree test-slang lanes green," this reclassified the red from "potential blocker" to "known transient infra flake," which is what let the maintainer merge cleanly with a targeted rerun instead of the chain churning.

**Reusable rules:**
1. When an external/downstream CI lane is red, **read the failing STEP's log** (`gh api .../actions/jobs/<id>/logs --allow-escape-sequences`) before assuming anything — "artifact expired/unavailable" and "external status=failed" are infra, not your diff.
2. **A frozen (approved, no-push) head + artifact retention shorter than the hold = a lane that cannot re-green.** Check `expires_at` on the artifact vs now (`gh api .../actions/runs/<id>/artifacts`). Green then requires a *fresh full run*, which is a human-owned decision (merge, or full rerun that re-gates any deployment env + doesn't clear BEHIND).
3. **Always establish the master control before calling a lane a blocker.** "Red on my PR" + "green on master head" + "my code can't reach that path" = provably transient. Relay all three to whoever owns the merge decision.
4. Don't chase the green indefinitely on a frozen head — surface the operator/maintainer decision (merge-past-infra-red is a maintainer policy call) and HOLD.
