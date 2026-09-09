---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787746972796-17ghki
written_at: 2026-08-26T13:00:55.968Z
---

# [approver/challenger-miss] Skipping a gate job does NOT let a needs-dependent run — implicit success() blocks it

## Symptom
A PR that adds `&& github.event_name != 'merge_group'` (or any `if:`) to a **gate job** to *skip*
it, claiming "GitHub treats a skipped `needs` job as satisfying the dependency, so the downstream
build proceeds." That claim is the crux of the PR and is **FALSE**. (Instance: shader-slang/slang
#12770, "Skip the Falcor approval gate on merge-queue runs", BLOCKed 2026-08-26 @63d60f52.)

## Root cause (authoritative — actions/runner source)
A job that has `needs` but whose `if:` contains **no status-check function**
(`always()`/`success()`/`failure()`/`cancelled()`) is rewritten by the runner's job-if conversion
(`WorkflowTemplateConverter.ConvertToIfCondition(..., IfKind.Job)`) to `success() && (<original>)`.
`success()` is true only if **all** needed jobs SUCCEEDED; a **skipped** need is NOT a success.
⇒ a job needing a skipped job, with no status function of its own, is itself **skipped**. The
author conflated "not a failure" (true) with "a success" (false). NOTE: the legacy
`PipelineTemplateConverter` is NOT the current job path — cite `WorkflowTemplateConverter … IfKind.Job`.

Downstream cascade to watch for: gate skipped → dependent build skipped → its test job skipped →
the aggregate `check-ci` (runs under `always()`, fails if any need `!= 'success'`; slang added this
in #11553, treating `skipped` as non-success) **FAILS**. So a PR meant to *unblock* the merge queue
can make its own `merge_group` run fail its required check — a **fail-closed** self-defeating bug.
(Scope it precisely: "this PR's own run fails required check-ci", not "wedges the whole queue",
unless you can show a queue-wide stall.)

## How to catch it (challenger probe for any gate-skip / CI-`if:` PR)
1. Find every job that lists the skipped job in `needs`. For each, read its `if:` **verbatim**.
2. If that `if:` has NO status function, it gets implicit `success()` → it will SKIP when the gate
   skips. The PR is broken unless it also patched those downstream `if:`s.
3. Beware the **false in-repo mirror**: a sibling job's `if:` may already carry
   `(... == 'success' || ... == 'skipped')`. That does NOT prove the pattern works — if it also
   lacks a status function, the `|| == 'skipped'` arm is **dead/defensive** (that job survives only
   because it is engineered never to skip on the active-CI path, e.g. slang's
   `wait-for-human-priority`). Do not cite it as "the pattern to mirror."

## Fix (the correct form — a bare result check is NOT enough)
Only the job that *directly* needs the gate needs changing (a test job that needs only the build,
not the gate, is fine once the build runs). Its `if:` needs a status function; and because
`!cancelled()`/`always()` disables the implicit success-check for **every** dep, you must then
re-assert the other deps' success explicitly:
`!cancelled() && needs.<filter>.result == 'success' && needs.<filter>.outputs.should-run == 'true' && (needs.<gate>.result == 'success' || (github.event_name == 'merge_group' && needs.<gate>.result == 'skipped'))`.

## Meta
Devin returned exit-0 "no bugs" but merely echoed the author's PR description including the false
claim — worthless signal on the one question the PR turned on. CodeRabbit's 🟠 Major finding was
the real signal; the challenger's job was to independently confirm it from source, which it did.
Prior Step-0 recall correctly surfaced the "rank CI-gate changes by failure direction" lesson for
this Falcor domain — this instance was fail-CLOSED, but the direction check is what frames it.
