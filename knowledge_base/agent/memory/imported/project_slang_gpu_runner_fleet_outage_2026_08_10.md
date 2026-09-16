---
name: project_slang_gpu_runner_fleet_outage_2026_08_10
description: "2026-08-10/11: slang Linux-GPU (GCP) self-hosted runner pools starved ~15.5h, master frozen behind the merge queue, #12437 blocked. Durable lessons: a total outage CANNOT trip a queue-DEPTH alarm (alarm on AGE + total==0 AND queued>0 sustained ≥2 frames); and a SENTINEL IS NOT A NULL — enumerate a field's values across all states before using absence as a discriminator."
metadata:
  node_type: memory
  type: project
---

# 2026-08-10/11 — Linux-GPU runner pools starved; the monitored alarm could not fire

`slang-discord-support` reported a capacity outage; I verified it from a different instrument than theirs, needing no runner-admin scope (`/actions/runners` 403s for this token). The verification instrument itself was corrected twice (see the sentinel section) — the final, controlled form is at the bottom.

**Final anchors (re-derived, over four corrections):** Linux self-hosted GPU pools (`Linux GPU (GCP)` + `Linux SM80Plus GPU (GCP)`) served nothing since `2026-08-10T17:09:31Z`; Windows GPU alive throughout (4/4); master frozen at `2026-08-10T16:15:55Z` (16.7h) behind merge-queue run `31415341472`; #12437 `mergeable_state=blocked`; GCP quota NOT the limiter (T4 4/24, L4 0/80); **mechanism deliberately unattributed** — "autoscaler stopped registering" vs "runners went offline" is not separable without the runner-admin page, which 403s. **Operator-only; reporting the effect with the mechanism explicitly unattributed is the honest shape.**

## ⭐⭐⭐ Durable finding 1 — a total outage cannot trip a queue-DEPTH alarm

Documented alarm was `jobs_queued > 30`; during the outage it read 20–25. Queue depth climbs only while servers are BUSY accepting work; when servers VANISH, depth FLATLINES at whatever was in flight. `busy == total` fails vacuously at 0/0 too ("0==0 is healthy").

⇒ **The alarm is ANTI-CORRELATED with the worst failure: the more completely capacity disappears, the less the depth metric moves.** Age is monotone in badness; depth is not. Same family as a watchdog whose `success` conclusion is blind to the condition it exists to clear.

⇒ **CORRECTED predicate (base-rate-checked): `total==0 AND queued>0`, sustained ≥2 CONSECUTIVE frames — PLUS oldest-queued AGE.** `total==0` ALONE appears in 1119 frames back to 2026-02-27 (the pool scales to zero by design when idle), so it would fire constantly; even the conjunction is usually one frame of scale-up lag. This predicate would have fired ~14h earlier. **A condition that is normal 1119 times is not an alarm; the alarm is the conjunction plus duration.** Size incidents on DURATION × DEMAND: the only longer episode (26.0h, 2026-03-07) had peak queue 4 and was harmless.

## ⭐⭐⭐ Durable finding 2 — a sentinel is not a null (the GitHub-Actions API sentinel inventory)

The verification instrument was refuted and corrected FOUR times in ~24h, each time because a queued/absent state masqueraded as execution. The full inventory, earned over those corrections:

- **run-level `status` is an AGGREGATE over jobs** — a run whose run-level status is `queued` can contain 34 *completed* jobs. Count EXECUTING JOBS, not runs. (`in_progress` runs == 0 answered "are any runs wholly unstarted", not "is anything executing".)
- **`runner_id != null` passes every queued job** — a queued job has `runner_id: 0` (a sentinel), `runner_name: ""`. Using `!= null` dated one outage from a job that never ran → reported an 11.3h outage as ~30 min (22× understatement that reads as RECOVERING).
- **`started_at` is populated on `status=queued` jobs**, where it is a QUEUE timestamp, not an execution start → nearly produced a false "RECOVERY".
- **empty `runner_name`/`labels` ALSO means `conclusion: skipped`** — a skipped job never touched the pool; co-occurrence, not cause.
- ⇒ **CORRECTED discriminator: `status=="queued" AND runner_name` non-empty-check — but read `conclusion` FIRST** (a conjunction is not a filter until you know which populations, incl. skipped, are present).

⇒ **THE GENERALIZATION, which applies to every absence-based predicate I write: `null`, `0`, and `""` are DIFFERENT states.** Before adopting "field X is absent" as a discriminator, ENUMERATE the field's actual values across all states first — one `group_by (status, field-shape)` shows it. And one level up: **an ABSENT KEY is not `total: 0`** — `runner_groups` omitted "Windows GPU" for three frames; rendering absence as `0/0` would have fabricated "Windows GPU died" (the inverse of the truth). Three states to separate before any absence claim: present-and-zero · present-and-sentinel · absent.

## ⭐⭐⭐ Error directions and self-critical claims

- **A false RECOVERY is worse than a false alarm: it closes an incident.** Two of the sentinel traps above (queued `started_at`, `runner_id!=null`) failed specifically in the recovery-looking direction.
- **`committer.date` timestamps the merge-queue BUILD; `/activity?ref=refs/heads/master` timestamps the LANDING** (same SHA, 89-min gap). I re-derived the wrong answer from `/commits?sha=master` in an operator report — verbatim [[technique_merged_at_not_committer_date_for_merge_time]], a rule I had already written. **The trigger has to be the QUESTION ("when did this land?"), not a memory of having been burned.**
- **A retraction is a claim and needs the same test as the thing it retracts.** The peer retracted `in_progress` as "a constant", which was strictly stronger than "does not discriminate here" and false — it over-corrected in the self-punishing direction, which is exactly what stops anyone from checking it. The surviving form is ASYMMETRIC: `in_progress==0` is NOT sufficient for "outage" (a run with mid-flight jobs reads `queued` at run level), while a NON-ZERO reading IS trustworthy.
- **A concession is a claim: resolve the subject to a fact before accepting blame.** I twice inferred a habit-level fault from a correct-conclusion-wrong-mechanism read (#12446 "carried a stale item" — it was a fresh measurement racing a 2m15s author fix, no prior wake to carry from). A right verdict does not license a diagnosis; the correct habit is to **TIMESTAMP THE OBSERVATION** ("as of 08:43:28Z, `labels: []`") so a 10-min-old state claim can't read as live.

## ⭐⭐ Process / instrument traps (reusable)

- **A LATE WAKE IS INDISTINGUISHABLE FROM A QUIET ONE unless `process_after` is compared to `date -u`.** A group's Discord channel went unscanned 3h29m and the silence looked like calm. Every scheduled agent should print `now − process_after` at wake — one line that converts an invisible failure into a visible one. (`ncl tasks list` shows LAST/NEXT RUN, neither of which answers "am I late".) This backlog recurred (3h21m, twice, with duplicate frames delivered) — a pattern, and why a 15h outage went ~5 wakes without a draft.
- **A cross-repo positive control silently becomes an auth probe** — a `nodejs/node` control returned an empty count that looked like agreement but was `{"message":"Bad credentials","status":"401"}` (the gateway injects credentials PER-PATH). An empty control validates nothing until you print its raw body.
- **PTX contains a NUL** ⇒ plain `grep` says "binary file matches" and prints nothing; use `grep -a`. Nearly read an empty column as "all failed".
- **A `?per_page=N` general-list window spans ~20 min**, so it cannot contain a 200-min-old queued run → a "GPU queued = 0" window artifact. Query `?status=queued` directly, and print the empty-label count beside any label-filtered count (24/44 scanned jobs had empty `labels`).
- **When paging to widen a search for a NEWEST value, an early `break` INVERTS the answer** — exhaust the newest page first.
- **ONLY A BASELINE DISTINGUISHES ABSENT FROM LOST** — a checker that prints `LOST` for `ABSENT` (58/69 leaves have no `title` at all) invents defects; without a baseline, report ABSENCE and refuse to call it LOSS.
- **"predates the outage + its GPU legs passed" is the right discriminator** against blaming infra for a code defect (the peer's 5-findings/5-distinct-causes triage correctly cleared a real human-PR test failure as unrelated).
- **The index is a router, never a source** — compaction shortens hooks (rules/triggers survive, enumerated figures do not). Date any figure in an index and never quote it live; re-derive with the recorded command.

## Scope discipline

Scope narrowed THREE times, each narrowing from the peer measuring a pool I had lumped in: not "the GPU fleet" → not "Linux self-hosted" → not "GCP" → specifically the `Linux GPU (GCP)` + `Linux SM80Plus GPU (GCP)` pools (`falcor-bridge` Linux runners served fine). ⭐⭐ **A "contradiction between two instruments" is the shape that most often turns out to be a missing term in my own arithmetic** — the "quota 16/24 vs runner_groups 0/0 contradiction" I helped publish was an omitted addend (against Linux+Windows busy, T4 reconciles). Check the addends before publishing the paradox.
