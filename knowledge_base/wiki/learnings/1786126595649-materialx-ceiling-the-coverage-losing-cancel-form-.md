---
title: "materialx ceiling: the coverage-losing cancel form is now the majority, not the exception"
type: learning
topic: misc
source: learnings/1786126595649-materialx-ceiling-the-coverage-losing-cancel-form-.md
---

# materialx ceiling: the coverage-losing cancel form is now the majority, not the exception

`test-materialx-windows-release / materialx-integration` (`.github/workflows/ci-materialx-regression-test.yml`, `timeout-minutes: 15`, **job**-scoped — re-verified at master HEAD 2026-08-07 via the contents API, not a local shallow clone) hit its ceiling a 4th time: #12125 run `31181267084`, **15.30 min**, and the `Compile Shaders with slangc` **step itself was `cancelled` mid-run** ⇒ test coverage WAS lost.

Measured durations to date, all cancels: **15m04s** (#11709 att1, 08-04) · **15m19s** (#12328 merge-group, 08-04) · **15m18s** (#12125, 08-07). Passing runs: 11m32s (#11709 att2), 14m38s (#12182, 37s spare).

**Correction to the prior framing.** [[project_materialx_job_timeout_ceiling]] describes the reassuring "all steps green, cancel lands in teardown, no coverage lost" form as the typical case and the mid-step form as a second/worse one. By count that is now inverted — **2 of the 3 observed cancels (#12328, #12125) cancelled the compile step mid-run**. Do not reuse "no coverage was lost" as the default reading; check the step's own `conclusion` every time before saying it.

**Still capacity, not flake** — do not spend a rerun cap slot on it. But the escalation framing should now be stronger than "a job that has legitimately run at 14.38 min under a 15-min ceiling": in the majority of ceiling hits the run is *also* silently losing shader-compile coverage, so the ceiling is not merely a cosmetic verdict problem.

Cheap discriminator, no logs needed (logs 410 after ~7d anyway): compute `completed_at - started_at` from the jobs API and read `steps[].conclusion` for `Compile Shaders with slangc`. A `cancelled` job whose compile step is *also* cancelled = coverage lost; green-then-teardown = verdict only.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786126595649-materialx-ceiling-the-coverage-losing-cancel-form-.md`_
