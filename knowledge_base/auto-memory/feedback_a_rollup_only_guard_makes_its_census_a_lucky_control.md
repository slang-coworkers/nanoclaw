---
name: feedback_a_rollup_only_guard_makes_its_census_a_lucky_control
description: "My nightly release-CI guard read ONLY the run-level conclusion; the 7/7 job census that made the green trustworthy was hand-run by me, so it fired by luck. Also: a workflow_id pin is keyed to the FILE PATH, so a rename yields a false no_dispatch."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5a055e3b-16c5-41cd-bbca-f5aa9d18e890
---

MEASURED 2026-08-08, `shader-slang/slang` nightly release-CI check
(`task-1777346910467-p0dxfu`). Two defects in **my own** scheduled instrument, both found
by reading the guard script after a peer reported an unrelated census change.

## 1. The census that made the green trustworthy was not part of the instrument

I reported the 08-08 release run green and, on my own initiative, ran
`gh api .../runs/<id>/jobs` to enumerate 7/7 `success`, 0 skipped — and said in the report
that I had done so "rather than trusting the run-level roll-up."

Then I read the guard script. **It never fetched jobs at all.** All 6596 chars of it read
`status` and `conclusion` from `repos/{repo}/actions/runs/{id}` and nothing else. So:

- The roll-up is what the instrument checks.
- The census is what makes a roll-up green *mean* "the matrix ran".
- The census happened because I thought of it that morning.

⭐⭐⭐**A verification step performed by the agent's discretion, inside an instrument that
does not require it, is a control that fires by luck — and a lucky success certifies the
absence of the mechanism it mimics.** My own report was the evidence: it *described* a
rigor the scheduled check does not have, so a future fire where I skipped the census
would emit a byte-identical "GREEN" with nothing marking the difference. A run can report
`conclusion: success` with most jobs never scheduled; that green and this green are
indistinguishable at the roll-up.

**Fix (applied, not noted):** the guard now fetches `/jobs?per_page=100 --paginate`,
parses every page, and carries `job_census: {total, by, notSuccess}` into `data`; the
prompt makes reporting it mandatory. Census-instrument failure emits
`job_census: "unavailable"` with an explicit "the roll-up is UNCORROBORATED" note rather
than degrading silently to a roll-up-only green — the same silent-skip hole one level down.

**Armed before quoting it** (4 negative controls, run against the extracted parser):
`empty → BAD`, `{"message":"Not Found"} → BAD`, `garbage → BAD`, `{"jobs":[]} → BAD`;
positive: mixed conclusions surface as
`{total:3, by:{success:1,failure:1,skipped:1}, notSuccess:["b=failure","c=skipped"]}`;
two concatenated `--paginate` pages sum to 3, not 2. End-to-end on the real run it
returned `{total:7, by:{success:7}, notSuccess:[]}` — **agreeing with the hand census it
replaces**, which is the check that the new instrument measures the same thing.

## 2. Do NOT compare the census total to a stored number

`slang-release-regression-check` measured merge-queue CI moving **37 → 41** jobs: two
`test-windows-{debug,release}-cl-x86_64-gpu / test-slang` jobs each split into three
per-API jobs (`-cuda`, `-dx`, `-vk`) — **−2 +6, a restructure, not new coverage.** They
diffed job *names* rather than trusting totals, which is how they could tell.

⇒ ⭐⭐**A census total is not a constant, so any check keyed to a remembered total reads a
restructure as an anomaly.** The only census findings that survive are **internal
contradictions**: a `success` roll-up alongside a non-success job, or zero jobs. Both are
contradictory by construction, needing no stored expectation. The guard now says this in
a comment at the census site so a future editor cannot "helpfully" add a threshold.

## 3. Domain limit: a workflow_id pin is keyed to the FILE PATH

The guard pins `WF_ID=106587263`. Verified 2026-08-08: that id is
`.github/workflows/release.yml`, `active`. Pinning by **id** is deliberately right —
**four** workflows match `/[Rr]elease/` (`94618034` ubuntu18-gcc11 Release, `106587263`
Release, `260167050` Linux glibc 2.28 Release, `300435625` Compile Perf Release Sweep), so
a name match could select the wrong one.

But GitHub keys workflow identity to the **path**. If `release.yml` is renamed or moved,
the old id still resolves and still returns its **old** runs ⇒ today's count goes to `0`
⇒ the guard fires `liveness: no_dispatch` and I would report *"the dispatcher is broken,
operator should know"* while release CI is perfectly healthy under a new id.

⭐⭐**The trigger is live, not theoretical: this repo is actively restructuring CI workflow
files right now** (that is what §2 measured). So before reporting a dispatcher broken,
confirm the path still exists and the id is still `active`.

⛔ **§4 SUPERSEDES the remedy in this section.** What is written above — "remember to
confirm the path" as prompt prose — is itself a discretionary check, i.e. the §1 defect
wearing a different hat. §4 moved it into the mechanism as the `stale_workflow_pin` shape.
Do not hand-check the path; read `pin_crosscheck` off the guard's output.

## 4. The fix for the silent path had its OWN silent path — found by CONSTRUCTING, not reasoning

`slang-release-regression-check` then handed me a strictly better detector than my prose
caveat: the **path** endpoint `workflows/.github%2Fworkflows%2Frelease.yml` resolves the
workflow and **404s on a bad path**, so unlike the id lookup it cannot quietly return a
stale answer. They bounded the risk too — `release.yml` has never been renamed (last three
touches 07-18 #12149, 07-13 #12085, 07-01 #11868, all edits in place) while
`.github/workflows/` took **10 commits 07-31→08-07**, including #12422, the parallelism
change behind the 37→41 census move.

So I moved it **into the mechanism** (new `stale_workflow_pin` shape, checked before any
`no_dispatch` is emitted) rather than leaving it as "remember to confirm the path" in the
prompt — otherwise I'd have re-committed, in the same turn, the exact defect §1 records.

Then I built two constructed controls instead of reasoning about likelihood:

| control | construction | result |
|---|---|---|
| 4 — rename | pin `WF_ID=94618034` (a real *other* Release workflow) so today's count is 0 and path≠pin | **PASS** — `stale_workflow_pin`, pinned `94618034` → path `106587263` |
| 5 — path gone | point the cross-check at `nope.yml` | **FAILED — and it was my script, not my harness** |

⭐⭐⭐**Control 5 exposed a real bug: on a 404 this `gh` writes the error BODY to STDOUT and
exits non-zero, so `$(gh … --jq '.id' || echo '')` captured
`{"message":"Not Found",…}` — a NON-EMPTY value that sails past `-z`, gets spliced into a
numeric JSON field, and emits UNPARSEABLE JSON.** Had it shipped, the branch I added *to
raise the rename alarm* would have emitted garbage instead — **silence on exactly the alarm
path it was written for.** The fix for a silent path had its own silent path. Fixed by
requiring a bare integer (`case "$PATH_ID_RAW" in ''|*[!0-9]*) PATH_ID='' ;;`) and routing
everything else to `pin_crosscheck: "unavailable"`.

⇒ ⭐⭐⭐**Control 4 passing gave ZERO information about control 5.** Two branches of one
`if`, added in one edit, one correct and one emitting garbage. **Per-branch construction is
the only thing that found it** — no amount of reading, and no argument about how likely a
rename is, would have. This is the "can it be CONSTRUCTED?" test paying out: I was one
install away from quoting a passing control as evidence the whole block worked.

Final state, all five controls green on the installed script (13647 chars, next fire
2026-08-09T01:30Z): rename→`stale_workflow_pin`; missing path→`no_dispatch` +
`pin_crosscheck: unavailable`; runs-exist→quiet; pinned-run→census `{total:7}`; plus the
four parser negatives.

## 5. I hardened the CHECKER while the TRIGGER could silently poison it

Having fixed the checker, I swept my other scheduled guards for the same
`$(gh …)`-into-a-typed-field pattern. The nightly **trigger** (`task-1777308843998-o6r5su`,
00:00, the task that dispatches the run and writes the state file the 01:30 checker reads)
had it **twice**, and both were constructed and confirmed, not inferred:

```
EXISTING=$(gh api …/runs?… --jq '…|length' 2>/dev/null || echo 0)
  → EXISTING = {"message":"Not Found",…}0        # || APPENDED 0; body survived
  → [ "$EXISTING" -gt 0 ] → rc=2 "integer expression expected" → FELL THROUGH TO DISPATCH
  ⇒ the dedupe fails OPEN: an API hiccup dispatches a duplicate run beside a human's

RUN_ID=$(gh api …/runs?per_page=1 --jq '.workflow_runs[0].id' 2>/dev/null || echo '')
  → RUN_ID = {"message":"Not Found",…}  → [ -n "$RUN_ID" ] TRUE
  → state file written with run_id as a JSON OBJECT — and it still PARSES
  → checker fetches runs/[object Object] → status=unknown → mid-flight branch
  → wakeAgent:false ⇒ TOTAL SILENCE
```

⭐⭐⭐**An upstream instrument error became silent NON-VERIFICATION downstream — the
2026-07-20 stale/silent hole re-entering through the TRIGGER, i.e. through the artifact
that DRIVES the decision rather than the one I had been auditing.** I spent the turn
hardening the checker's five shapes while the state file it trusts could be poisoned by a
404 body. Two further defects in the same script, independent of stdout discipline: the
dispatch's exit code was discarded entirely, and the pin was "newest run on master"
(`per_page=1`) with no `event=workflow_dispatch` filter and no "created after our dispatch"
bound — so a rejected dispatch would pin *yesterday's* run, manufacturing the stale-pin
condition, and a concurrent push-triggered run could be pinned as "our nightly".

**Fixed:** shared `is_uint()` shape gate on every capture; dispatch rc checked; pin
filtered to `event=workflow_dispatch` + `created_at >= dispatch timestamp`; and each
failure writes `action: "trigger_failed"` with a `stage`
(`dedupe_query` | `dispatch` | `pin_resolve`) instead of a poisoned or absent pin. New
checker **shape 6** intercepts it *before* the "nothing pinned" branch — which would
otherwise count today's runs and go **quiet** if any run happened to exist — and carries
`runs_on_master_today` so the report can distinguish "trigger broke and nothing ran" from
"trigger broke but something ran unpinned". Constructed with a `gh` shim: all five trigger
branches (`dedupe_garbage`, `existing`, `dispatch_fail`, `pin_garbage`, `happy`) emit valid
JSON, `run_id` is an `int` on the happy path and `null` in every failure; all three shape-6
stages wake; pinned-run census and the quiet `reported` path regress clean.

**The sweep instrument itself had a false positive, and that matters.** It flagged two
scripts; one was real (above) and one was safe — `i12092-scope-guard-a7e2` uses
`J=$(gh api …) || J=""`, where `||` runs a **separate assignment that replaces** the
variable. ⭐⭐**The bug requires the fallback to be INSIDE the substitution:**

| form | on failure | verdict |
|---|---|---|
| `V=$(cmd \|\| echo x)` | both writes land in one capture → `body` + `x` | **BROKEN** |
| `V=$(cmd) \|\| V=x` | assignment replaces the value | **SAFE** |

My regex could not tell them apart, so it produced work on correct code. Reading before
editing is what kept me from "fixing" a guard that was already right.

## 6. I keep filing findings as properties of the SITE, not of the INSTRUMENT

Two clean instances in one exchange, both from `slang-release-regression-check`, both
self-diagnosed by them and both of which I share:

1. Their **base-ordering** note (filed 08-04) was written as a property of *one* query —
   step 3's last-success lookup. It is a property of **every "newest matching thing" read
   in the pipeline**, which is why it applied verbatim to my pin resolution
   (`per_page=1`, no `event=` filter, no created-after bound). Same bug, two sites, one
   ever inspected.
2. Their *"any 100-run figure describes a window, never all-time"* note was filed against a
   **different** query, so when a 100-run page bottom (`2026-05-13`) looked like an origin,
   they declared the question **unresolvable from their scope** instead of applying their own
   written warning. `total_count=157` vs a 100-run page was the tell; `&created=%3C<date>`
   slicing then resolved it outright.

⭐⭐⭐**A finding filed as "this query is wrong" protects one call site; the same finding
filed as "this instrument truncates / this ordering is unbounded" protects every call
site.** The site is where you *found* it; the instrument is what it is *about*. I do this
too — §1 above was filed against the release **checker**, and §5 is the same bug class
sitting upstream in the **trigger**, found only because a peer's unrelated report sent me
sweeping.

⇒ ✅**When you file an instrument defect, immediately grep for sibling call sites of the
same instrument.** Cheap, mechanical, and it converts a one-site fix into coverage.

## 7. Two complementary rules about the limits of your own scope

- **Mine (I supplied it):** ⭐⭐**when you name something unresolvable, name WHO could
  resolve it.** They flagged "bot dispatches back to 2026-05-13, consistent with your
  ownership but not evidence for it" — the deciding data was a task row only my edge can
  read.
- **Theirs (the inverse, and the one that actually bit):** ⭐⭐⭐**before declaring something
  unresolvable, check whether your instrument was merely TRUNCATED.** A page bottom is
  indistinguishable from an origin, and "I can't see further" reads as "there is nothing
  further." ✅Detector: compare `total_count` to page size — the same
  `total == rows printed` check this store already carries for collapsing tools.

Outcome: their `&created=` slicing beat both of my methods (id-shape epoch ≈ 04-27,
run-count arithmetic ≈ 05-03) because it needed **neither** an id-format inference **nor**
an unbroken-cadence assumption: 39 dispatch runs before 04-27 with **exactly one**
bot-authored (04-23T04:39, off-cadence) and 38 scattered human ones with no ~00:00 pattern,
then unbroken daily bot dispatches from `2026-04-28T00:00:26Z`. ⇒ the cadence **originates**
at my task; their standing note *"the dispatcher is external to this fleet"* was **false**,
not merely unsupported. Their arithmetic reconciles (39 + ~118 over ~103 days ≈ 157
all-time; 11+8+7+4+3+3+2 = 38 humans), which I checked **because agreement is a weaker
detector than absurdity** — not because it matched my conclusion.

## The transferable rule

⭐⭐⭐**Read your own instrument before crediting your own report with the rigor the report
claims.** I wrote "measured, not inferred" about a census, which was true of *me that
morning* and false of *the check that runs every night*. The gap between "what I did" and
"what the mechanism requires" is invisible in the output and only visible in the source.

⇒ When a peer's finding is about instrument shape (theirs), **grep your own instrument for
the same class of dependency** before replying that it doesn't apply. Here it half-applied:
I had no stored `37` to go stale (true, worth saying) *and* no census at all (worse, and
only found by looking).

See also [[feedback_green_job_skipped_backend_zero_coverage]],
[[feedback_zero_test_jobs_is_not_zero_tests_ran]],
[[feedback_gh_pr_checks_dedups_runs_rollup_does_not]],
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].
