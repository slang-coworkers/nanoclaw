---
name: the-event-you-report-can-invalidate-your-own-ci-measurement
description: "A draft→ready flip RELEASES the priority-yield gate, so \"no build signal on this head\" flips from true to false within ~30s of the very event being reported; re-measure CI AFTER any state transition you are reporting, not before."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**Two coworkers independently reported "CI shows no build signal on this head — benign priority-yield, zero build jobs" on shader-slang/slang#12353, and both were REFUTED by measurement.** Fixer said it at 21:37Z, reviewer escalated it at 21:39Z as a thing to warn the maintainer about ("zero build/test jobs on this head is more likely to be misread as a pass than it was in draft"). Measured 21:40Z: **11 build/test jobs completed `success`, 5 `in_progress`, zero failures among them.**

**Why:** the claim was TRUE while the PR was a draft and became FALSE at the moment of the event both reports were about. `jkwak-work` flipped `ready_for_review` at **21:14:38Z**; a fresh `event=pull_request` CI run started at **21:14:42Z**, and `wait-for-human-priority` — which had `failure` at 14:49:18Z under the draft — re-ran `success` at **21:15:06Z**, releasing the gate. Real jobs began 21:15:18Z. So the draft-era measurement was correct *and* obsolete, and the flip is precisely what obsoleted it.

⭐⭐⭐ **The state transition you are reporting is a cache-invalidation event for every other fact in the same report.** This is the trap: a report *about* a draft→ready flip is the report most likely to carry a draft-era CI read, because the CI read was gathered while establishing the context that the flip then changed. Both agents gathered facts, the world moved, and neither re-measured the one fact the move touched.

⭐⭐ **Stale rows survive alongside fresh ones and read as current.** `check-ci` and `wait-for-human-priority` each have BOTH a `failure` (14:49Z, superseded) and a later row (`wait-for-human-priority` `success` 21:15:06Z). Grepping for `failure` without sorting by `started_at` returns the dead run's verdict. **Sort check-runs by `started_at` and read the NEWEST row per name**; a bare conclusion grep answers a question about history, not about now.

⛔ **`per_page=100` is NOT enough on this repo — #12353's head has `total_count=118`.** My first census returned **101 of 118 rows** and I nearly published from it. Always diff `rows` against `total_count` and page until they match. (Same defect family as the `(.jobs|length)` page-size trap in [[project_slangwin5_spirv_val_runner_defect]] — recurring because the bound is silent.)

**How to apply:** before stating any CI conclusion, (1) fetch all pages and assert `rows == total_count`; (2) filter to real jobs (`/ build`, `/ test-slang`, `/ sanitizer`) rather than the ~50 skipped bridge/assistant rows that make a healthy head look empty; (3) take the newest row per job name; (4) stamp the measurement time. And if the report describes a state change, re-measure **after** it. Do not let a coworker's CI claim reach a maintainer's thread unverified — this one was two-for-two wrong and was headed for jkwak-work's PR. See [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]] and [[feedback_drafts_only_guardrail]] (the flip itself was a legitimate maintainer action — no breach).

⭐⭐⭐ **A `rows == total_count` BOUND-CHECK IS ITSELF A TIMESTAMPED OBSERVATION — passing it does not mean you saw the whole run.** Measured on this same PR: I published `rows=35/35 bound-checked` at 22:39:58Z; the run then **grew to 37** as a passing build spawned dependent legs, and the new `check-ci` failure at 22:40:22Z was outside my "complete" census. **The check was valid when taken and stale when read.** A growing GitHub Actions run makes completeness a property of an instant, not of a query — so a bound-check certifies *"I paged fully"*, never *"the set is final"*. ⇒ **Only a run whose own `status == "completed"` bounds the job set; until then, stamp the census time and re-take it, and expect the count to grow (18 → 27 → 35 → 37 observed on one run).** The peer's broadened trigger caught the 37th job 10 s after it completed while my "complete" snapshot was already wrong — a defect in the strongest instrument I had, of exactly the class this file documents for claims.
