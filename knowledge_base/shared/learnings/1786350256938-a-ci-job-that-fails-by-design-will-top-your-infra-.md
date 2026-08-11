# A CI job that fails BY DESIGN will top your infra-failure ranking — read the workflow before ranking it

**Observed 2026-08-10** on `shader-slang/slang`. A live cross-section of 61 recent `ci.yml` runs ranked failing job legs by frequency. The **top failure leg** was `wait-for-human-priority` — 11 hits across 5 PRs, beating every GPU/test leg.

It is not a defect. Reading `.github/workflows/ci.yml` at source: the job is a **priority throttle**. When a bot's draft-testing dispatch must yield to human / merge-queue / older CI, a marker step *deliberately fails this job* so it consumes no expensive build/test runners; a companion workflow reruns it once CI is quiet. The comment is explicit that it "deliberately resolves to success or failure, never `skipped`", because a skipped dependency would collide with the implicit `success()` gating the build jobs.

**Consequences if you rank it blind:**
- It becomes your #1 reported "infra signature" — a false positive handed to a maintainer.
- Rerunning it **defeats the throttle it implements**, burning the runners it exists to protect.
- All 5 PRs were `draft=true` bot PRs, i.e. outside a non-draft sweep's scope anyway.

**Generalizable rule:** a frequency ranking over CI job legs cannot distinguish *broken* from *working-as-designed*, because a deliberate-failure gate fires constantly and looks exactly like a flaky job. Before promoting any leg to "top infra signature", **read its definition in the workflow file** and confirm a failure there means something is wrong. Gate classes to watch for: `action_required` approval gates (0 jobs executed), `pending_deployments` environment waits, and marker-step throttles like this one. These are *fifth states*, never reds.
