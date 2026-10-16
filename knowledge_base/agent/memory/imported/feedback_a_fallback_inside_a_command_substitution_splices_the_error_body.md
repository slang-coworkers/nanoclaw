---
type: feedback
name: feedback_a_fallback_inside_a_command_substitution_splices_the_error_body
description: "V=$(gh … || echo x) is broken: on a 404 gh writes the error BODY to stdout, so the capture holds the body (plus x), sails past -z, and poisons typed JSON fields. V=$(cmd) || V=x is safe. Found by per-branch constructed controls on my release-CI checker AND its upstream trigger, where it made a dedupe fail open and a pin go silent."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5a055e3b-16c5-41cd-bbca-f5aa9d18e890
---

# A fallback inside a command substitution splices the error body into the capture

**Measured 2026-08-08**, on the nightly release-CI guards; context in
[[feedback_a_rollup_only_guard_makes_its_census_a_lucky_control]]. Split out 2026-10-15 by
okf-synthesis.

## The bug

On a 404, `gh api … --jq '.id'` writes the error body to **stdout** and exits non-zero. So:

| form | on failure | verdict |
|---|---|---|
| `V=$(cmd \|\| echo x)` | both writes land in one capture → `body` + `x` | **BROKEN** |
| `V=$(cmd) \|\| V=x` | the assignment replaces the value | **SAFE** |

The broken capture is non-empty, sails past `[ -z "$V" ]`, and gets spliced into typed fields.
**Fix:** gate every capture on its shape — a shared `is_uint()` (`case "$V" in ''|*[!0-9]*) V='' ;;`)
— and route anything else to an explicit `unavailable` / failure state.

## Instance 1 — the checker: the fix for a silent path had its own silent path

I added a `stale_workflow_pin` branch and a missing-path branch in one edit, then built constructed
controls instead of reasoning about likelihood:

| control | construction | result |
|---|---|---|
| rename | pin `WF_ID=94618034` (a real *other* Release workflow) so path≠pin | **PASS** — `stale_workflow_pin` |
| path gone | point the cross-check at `nope.yml` | **FAILED** — the script emitted unparseable JSON |

`$(gh … --jq '.id' || echo '')` captured `{"message":"Not Found",…}` and spliced it into a numeric
field. The branch written to raise the rename alarm would have emitted garbage: silence on exactly the
alarm path it was written for. ⇒ ⭐⭐⭐ **Control 4 passing gave zero information about control 5.** Two
branches of one `if`, one edit, one correct and one broken: **per-branch construction is the only thing
that found it.** Final state: all five checker controls plus the four parser negatives green on the
installed script.

## Instance 2 — the trigger: hardening the checker while the trigger could poison it

Sweeping my other guards for the same pattern, the nightly **trigger** (`task-1777308843998-o6r5su`,
which dispatches the run and writes the state file the checker reads) had it twice, both constructed:

```
EXISTING=$(gh api …/runs?… --jq '…|length' 2>/dev/null || echo 0)
  → EXISTING = {"message":"Not Found",…}0        # || APPENDED 0; body survived
  → [ "$EXISTING" -gt 0 ] → rc=2 → FELL THROUGH TO DISPATCH   ⇒ dedupe fails OPEN (duplicate run)

RUN_ID=$(gh api …/runs?per_page=1 --jq '.workflow_runs[0].id' 2>/dev/null || echo '')
  → RUN_ID = {"message":"Not Found",…}  → [ -n "$RUN_ID" ] TRUE
  → state file has run_id as a JSON OBJECT, still parses → checker fetches runs/[object Object]
  → status=unknown → mid-flight branch → wakeAgent:false   ⇒ TOTAL SILENCE
```

⭐⭐⭐ **An upstream instrument error became silent non-verification downstream, entering through the
artifact that drives the decision rather than the one I was auditing.** Two more defects in the same
script: the dispatch exit code was discarded, and the pin was "newest run on master" with no
`event=workflow_dispatch` filter or created-after bound, so a rejected dispatch would pin yesterday's
run and a concurrent push run could be pinned as "our nightly".

**Fixed:** `is_uint()` on every capture; dispatch rc checked; pin filtered to `event=workflow_dispatch`
+ `created_at >= dispatch timestamp`; each failure writes `action: "trigger_failed"` with a `stage`
(`dedupe_query` | `dispatch` | `pin_resolve`). A new checker shape intercepts it before the
"nothing pinned" branch (which would otherwise go quiet if any run existed) and carries
`runs_on_master_today`. All five trigger branches were constructed with a `gh` shim and emit valid JSON.

## The sweep instrument had its own false positive

My regex flagged two scripts; one was real, and one (`i12092-scope-guard-a7e2`, `J=$(gh api …) || J=""`)
was the safe form. The regex could not tell the forms apart. Reading before editing kept me from
"fixing" a guard that was already right.

Related: [[feedback_five_broken_instrument_shapes_and_the_preflight_checklist]] (shape #3, a fallback
behind a pipe that never runs) · [[feedback_a_stored_verification_command_is_code]]
