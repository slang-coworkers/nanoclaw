---
name: project-12145-gbufferrttexgrads-d3d12-access-violation
description: "slang#12145: durable CI-flake anchor for renderpasses/test_GBufferRTTexGrads_d3d12 crashing Mogwai.exe on D3D12 only — ⛔ GREP `3221225477` (DECIMAL) or the test name, NEVER `0xC0000005`: the hex form returns ZERO on a genuine occurrence (Main-verified) because Mogwai prints the decimal return code; discriminator is that HSigmoid passes, so it is not the known fp16-tolerance red. Dominant merge-queue evictor — deduped + actor-verified 2026-08-05: 37 log rows -> 18 distinct eviction events; THIS signature is **10 of 18 (56%)** across **10** PRs, 7 consecutive days. ⛔ NOT 11/61% — #12243 was NEVER evicted (2 queue events only: added 07-29T18:26:56Z, removed 20:49:16Z `reason=merged`; the flake failed a merge-group run the PR SURVIVED). An operator spot-checking 12243 finds a clean merge, so the inflated figure would have discredited the ask. ⛔ A rerun cannot restore queue position. MEASURED across the whole population, not inferred from samples: **12 re-adds, 12 by a NAMED HUMAN, 0 by `github-merge-queue`** (pdeayton-nv 4 · fknfilewalker 2 · jkwak-work 2 · skiminki-nv 2 · saipraveenb25 1), latency **median 53 min, range 4 min – 14.0 h**; plus #12322 evicted 00:09Z and **still unpaid**. Only 5 reruns fired in the same window ⇒ rerun volume was never the cost. State: OPEN, assignee jkwak-work, untouched 9 days, ZERO fix PRs — ESCALATED TO OPERATOR 08-03 because the bot's channel is exhausted. ⛔ Do NOT dispatch a fixer (Infra + workflow YAML the bot cannot push); refreshes must EDIT comment 5062894889 in place, never post a second. ⛔ The babysitter's prior 'top signature' rankings were BROKEN (138 of 143 'rerun' records were non-actions; corrected 7d = 40 true reruns / 28 PRs), though #12145's dominance holds under the corrected method. ⚠ It is HOST-INDEPENDENT — fails on SLANGWIN4 too, so a #12145 red on a SLANGWIN5 run is not SLANGWIN5 evidence."
metadata: 
  node_type: memory
  type: project
  originSessionId: ac18452e-8cea-41c3-ae5f-95cac66b7141
---
## ⭐⭐⭐ WHERE THE PHANTOM "~15h AUTO-REQUEUE WINDOW" CAME FROM — a real number bolted to a nonexistent mechanism

The three longest re-adds are **14.0 h** (#12152), **13.4 h** (#12289), **11.0 h** (#12328) — Main-spot-verified
two of them: `pdeayton-nv` re-added #12152 after 14.0 h, `jkwak-work` re-added #12289 after 13.4 h. **All
three are humans. All three are overnight waits.**

⇒ ⛔**A long gap ending in a re-add looks exactly like slow automation and is actually a person asleep.**
That is how a correctly-measured constant got attached to a mechanism that never existed — and why it
corroborated a wrong reading so comfortably that two agents nearly published it.

⭐⭐**Method note (the reusable half): a first probe returned "never re-added" for 11 of 11.** Cause: it took
the **last** `RemovedFromMergeQueueEvent`, but on a merged PR that is always the *merge*, so every re-add
sorted before it. ⇒ **Count an eviction ONLY on `reason == "failed_checks"`; filtering by `__typename`
alone silently includes every merge** — and in a merged-PR population that is most of them. **A clean
11-of-11 was the tell: implausibility, not the data.**

## ✅ 2026-08-06 00:58Z — MAINTAINER DECIDED. The 17-day "needs a human" gate CLOSED; the ⛔no-fixer directive below is SUPERSEDED.

`jkwak-work` commented (`5199178497`) and **reassigned to `jkiviluoto-nv`** — Main-verified live via REST:
`state=open`, `assignees=["jkiviluoto-nv"]`, labels `Infra`+`CI Stability`, `comments=2`,
`updated_at=2026-08-06T00:59:01Z`. Verbatim direction: *"Assigning to @jkiviluoto-nv since it is CI
intermittency problem. I think that Falcor might have a bug but I don't think anybody will want to
investigate it at this point of time. I think we should add a retry logic just for this specific test
if it fails."*

⇒ ⭐⭐**The escalation worked, and it changed the TASK CLASS, not just the state.** The ask was
"fix-or-quarantine — undecided, needs a human"; it is now "implement a scoped retry — decided,
draftable." **So the `⛔ Do NOT dispatch a fixer` line further down is now WRONG, and only because
its PREMISE expired** (premise (a) *maintainer-assigned + undecided ask* is gone; premise (b) *bot
cannot push workflow YAML* still holds and is handled by the standard play below, [[project_bot_workflows_permission]]).
⭐⭐⭐**A prohibition stored without its premise outlives the reason for it — record WHY a route was
closed, or the next reader honours a dead veto.**

**Landing path is NOT a bot PR** — `.github/workflows/ci-falcor-test.yml` is unpushable by the App.
Standard play: draft + locally verify the diff, **post it as a ready-to-apply fenced diff comment**,
hand to `jkiviluoto-nv`. Precedent: #11586, slangpy-samples #50.

**Feasibility Main-verified 08-06 (do not re-derive):**
- Falcor `tests/testing/run_image_tests.py` accepts **`-f/--filter <regex>`** and **`-x/--xml-report <file>`**;
  it has **NO retry option** ⇒ the retry must live in the slang workflow, and a *test-scoped* rerun
  is possible via `-f`.
- Target is the **`falcor-image-test`** step of `.github/workflows/ci-falcor-test.yml`, currently
  `python ./testing/run_image_tests.py --config windows-vs2022-Release --run-only` — **no `-x` today**,
  so "was GBufferRTTexGrads the *only* failure?" is not currently answerable without adding it or
  parsing stdout.
- In-repo retry precedent: `.github/workflows/ci-slang-coverage-test.yml:279-281` (retry-once on
  intermittent failure).

✅**`test-falcor` IS a required check — it GATES MERGE. Main-verified 08-06 at BOTH halves**, after the
babysitter self-corrected a KB claim that said otherwise: `.github/workflows/ci.yml:675` lists
`test-falcor` in `check-ci`'s `needs`, **and** `ci.yml:700-709` computes `unsuccessful` from the
generic `needs` JSON (`select(.value.result != "success")`) and `exit 1`s if non-empty. ⭐⭐**Verify a
gating claim at the CONSUMER, not just the declaration** — being in a `needs` list proves ordering,
not gating; the `exit 1` is what proves gating. Note the comment there: *"Checking the generic `needs`
JSON (rather than enumerating each job) means any job added to `needs` above is gated automatically."*
⛔**Branch protection is 403 to the App — do NOT infer "not a required check" from being unable to read
the protection list** (that inference is what produced the wrong KB claim).

## ⭐⭐⭐ A RUN-LEVEL AUTO-RETRY ALREADY EXISTS — and it is predicate-scoped, which is the pattern this ask needs

`ci.yml:713-747` `retry-on-gpu-failure` → dispatches `ci-retry.yml` → `gh run watch` then
**`gh run rerun <id> --failed`**. Guards: `if: failure() && github.event_name == 'merge_group' &&
fromJSON(github.run_attempt) < 3`, and it only fires when a job has a **failed step named `GPU health
check` or `GPU post-test diagnostics`**.

⇒ **This is in-repo precedent for exactly the shape jkwak asked for: auto-retry gated on a predicate
that identifies the known-benign failure, not a blanket retry.** Cite it in the diff comment — it
makes the ask look conventional rather than novel.

⛔**It does NOT fire for #12145** (the step-name predicate doesn't match) — Main-verified on the known
#12322 eviction, merge_group run `30957913120`: **`run_attempt=1`**, `conclusion=failure`. Never
retried. So the flake's cost was never being absorbed by existing automation.

⚠️**Two candidate implementation sites now, and they differ in blast radius** — (a) inside the
`falcor-image-test` step of `ci-falcor-test.yml` (babysitter's chosen site), or (b) extending
`retry-on-gpu-failure`'s predicate at the run level. **(b) is `merge_group`-only, which is precisely
where this flake's measured cost lives** (queue evictions), but it reruns whole jobs. (a) is narrower.
Not a directive — a trade-off the drafter should decide explicitly rather than by default.

⛔⭐⭐**DESIGN CONSTRAINT that turns this ask into a bug if missed: a step-level blanket retry MASKS
REAL REGRESSIONS.** The step runs ~100 Falcor tests; retrying the whole step on any failure converts
every genuine red into a coin-flip. The retry must fire **only when GBufferRTTexGrads is the sole
failure** (hence the `-x` report), and must still fail the job if anything else failed. jkwak scoped
it correctly in prose (*"just for this specific test"*) — preserve that scoping in the implementation.

## ⛔⛔⛔ 2026-08-07 — THE DELIVERED DIFF IS DEAD. `test-falcor` WAS MIGRATED TO AN OPAQUE RUNNER BINARY 9.5 h BEFORE THE MAINTAINER REPLIED.

**Babysitter-found, Main-verified at every step.** Commit **`eea5b2753`** = *"ci: gate Falcor bridge
test-falcor behind falcor-ci approval environment (#11915)"*, **`2026-08-07 10:04:07 +0000`**. The
`test-falcor` job at HEAD is now, in full:

```yaml
  test-falcor:
    runs-on: [Linux, self-hosted, X64, falcor-bridge]   # was: [Windows, self-hosted, falcor]
    environment: falcor-ci                              # vet-and-approve gate, reviewers = ci-approvers
    steps:
      - name: Run external CI
        run: /opt/slang-ci/run-external-ci
```

- `grep -c run_image_tests .github/workflows/ci-falcor-test.yml` → **0 (rc=1)**. The command the gate
  parsed is gone.
- `grep -rl 'run-external-ci'` across the repo → **only the workflow itself**. `/opt/slang-ci/run-external-ci`
  is a **runner-image binary, not a tracked file** ⇒ **there is no in-repo layer the stdout-parsing gate can
  live in.** Not a preference change — the patched layer ceased to exist.
- ⚠️ Size correction: babysitter said 5,600 B → 3,456 B; the parent is actually **6,180 B** → 3,456 B.
  Direction and conclusion unaffected.

✅**Still merge-gating — re-verified post-migration at `ci.yml:677`** (job def now at `ci.yml:613`). So the
cost mechanism is unchanged even though the observability is gone.

⛔**SCOPE THE OBSERVABILITY LOSS PRECISELY — I OVERSTATED IT TO THE OPERATOR AND THE BABYSITTER CORRECTED
ME.** I escalated it as degrading "Falcor classification capability" generally. **It is narrower, and the
narrow version is both true and serious** — over-claiming invites the operator to discount it. Measured at
HEAD vs `eea5b2753^`:

| capability | status after 10:04Z |
|---|---|
| job red/green | ✅ retained |
| **which test failed + its crash code** | ⛔ **GONE** — this is the whole loss |
| which *step* failed | ⚠️ **degraded to worthless**: step count **7 → 1** (`Add Git Bash` / **unnamed `uses: actions/checkout`** / `Download Slang build` / `setup-falcor` / `Copy Slang to Falcor` / `falcor-unit-test` / `falcor-image-test` → **`Run external CI`**) |
| `Test (Falcor Perf)` sibling | ✅ **untouched** — still `[Windows, self-hosted, perf]`, 3 steps, `falcor_perftest.exe`; `git diff` on the perf job = **0 lines** |

⚠️**One refinement to the babysitter's own scoping:** it said *"I can still see which step failed."*
Technically true but now vacuous — with a single step, "which step" and "the job failed" are the same bit.
So the honest statement is: **red/green survives; everything finer than the job is gone; Perf is unaffected.**
⭐⭐**Both of us mis-scoped in the same exchange, in opposite directions — I too broad, it too generous —
which is why a capability claim needs a measured table, not an adjective.**

⭐⭐⭐**THE INSTRUMENT STOPPED MEASURING, AND THAT IS THE MOST IMPORTANT FACT ON THIS ISSUE NOW.** The new
logs cannot name individual tests, so **every signature-keyed detector in this file — the decimal
`3221225477` probe, the test name, the HSigmoid discriminator — is blind by construction on
post-10:04Z runs.** ⇒ **A quiet #12145 after 08-07T10:04Z is NOT evidence the flake is gone.** The
babysitter correctly refused to call it fixed.

⛔**RATE FIGURES MUST BE SPLIT AT THE 10:04Z BOUNDARY — a single day-rate straddles an infra change and
describes neither regime:**

| window | fail/tested | rate |
|---|---|---|
| pre-10:04Z (Windows SLANGWIN) | 4/22 | 1 in 5.5 |
| post-10:04Z (Linux bridge) | 1/15 | 1 in 15 |

**All 4 confirmed-signature failures are PRE-boundary.** The lone post-boundary failure died at
`Run external CI` naming no test — **different class, do not merge it into this signature's count.**
The maintainer's *"roughly 1 in 6"* matches the babysitter's `merge_group` slice exactly (2/12); its
whole-day 5/37 = 1 in 7.4 is the straddling figure and was correctly not published as this flake's rate.
An unattributed 2.4-day "1 in 4.5" was likewise withheld.

⭐⭐**HOST-SKEW LEAN RETRACTED — refuted by a same-host pair.** SLANGWIN5 4/10 vs SLANGWIN4 0/12 looked
suggestive; run **`31137238034` failed SLANGWIN5 att1 and passed SLANGWIN5 att2**. ⇒ **a pass/fail pair on
ONE host refutes host-bound-ness directly**, so the maintainer's *"not machine-specific"* is right and the
skew was scheduler placement. Cheapest possible discriminator for any "is it host X?" claim.

⛔**`GBufferRTTexGrads_vulkan` DOES NOT EXIST in the suite** ⇒ *"d3d12-only"* is a **matrix property, not an
API-specific discriminator.** This file's earlier "D3D12 only, all other ~100 tests pass on D3D12+Vulkan"
framing overstates it; the test simply has no Vulkan variant to fail.

⭐⭐**THE PROCESS LESSON — a delivered artifact can be invalidated by an unrelated commit while the chain
sits open, and nothing notifies you.** The babysitter caught it only because it re-checked the file to
verify the maintainer's `--run-only` datum, and a `grep` returned rc=1. Had it replied from its 08-05
checkout it would have defended a patch that cannot apply, to the maintainer who would have to apply it.
⇒ ✅**Before defending or re-asserting a delivered diff, re-verify the target file at live HEAD.** Same
family as [[feedback_stale_index_describes_a_real_deleted_file]] — except here *we* were the stale index.

## ⭐⭐⭐ 2026-08-07 19:40Z — MAINTAINER `jkiviluoto-nv` REPLIED (comment `5221307479`). Four new facts; retry approach CORROBORATED independently.

Main-verified: 474 B, `2026-08-07T19:40:33Z`, issue now at **7 comments**, still OPEN, assignee
`jkiviluoto-nv`. Verbatim substance:

1. **Reproduced on hardware DIFFERENT from the original report's runners ⇒ "does not look
   machine-specific."** Independently confirms this file's standing `⚠ HOST-INDEPENDENT` note (which was
   derived from SLANGWIN4-vs-SLANGWIN5 reds). ⇒ **a #12145 red is still not host evidence.**
2. **`Mogwai.exe exited with return code 3221225477` (`0xC0000005`) — "confirms the access violation
   directly rather than by inference."** Note the maintainer wrote **both** forms; the store's grep rule
   is unchanged (**probe DECIMAL `3221225477` or the test name — the hex form returns ZERO in logs**).
3. **Sole failing test in the run — everything else passed.** Independently reproduces the selectivity
   discriminator, and is exactly the precondition the delivered gate keys on.
4. ⭐⭐⭐**"It failed with image comparison disabled, so the process crashed rather than producing a
   mismatched image."** This is the strongest causal statement on the issue to date: with `--run-only`
   there is no reference-image compare, so the failure **cannot** be a tolerance/reference-staleness
   artifact. It is a genuine process crash — which retires the whole "bad or stale reference image"
   hypothesis class.
5. **"Rate today was roughly 1 in 6 runs."** First maintainer-side frequency figure.

⭐⭐**ARITHMETIC CROSS-CHECK — two independent methods agree, which is the real corroboration:**
if p(fail)≈1/6 and attempts are independent, recovery-on-one-retry = **1−p = 83.3%**. The babysitter
measured **4/5 = 80.0%** from actual attempt-pairs. **Two routes, ~3 points apart** ⇒ the retry premise
holds on the maintainer's own number, not just ours. Residual after one retry ≈ (1/6)² = **1 in 36**;
after two ≈ 1 in 216. ⚠️**Independence is an ASSUMPTION** — a per-host or per-boot correlated cause would
break it, and the maintainer's own "different hardware" datum argues the cause travels with the test, not
the machine. Do not present the 1-in-36 as measured; it is a projection from one day's rate.

⚠️**A 6th comment existed that I had not seen:** bot recurrence log `5213306803` (2026-08-07T06:20:15Z) —
#11709 run `31119388554` attempt 2 on **SLANGWIN4**, `FAILED (6.5 s)`, HSigmoid passing both APIs,
`Test (Falcor Perf)` passing same host/attempt. Cost since 07-31: **28 declined-rerun decisions across 14
PRs + 9 reruns fired across 7 PRs** — largest live babysitter-work bucket. ⇒ ⭐⭐**Re-read the live comment
list before replying to a chain I believed closed; my last verified count was 5 and the true count was 7.**

## ✅ 2026-08-06 01:25Z — DELIVERED. Retry diff posted to `jkiviluoto-nv`; retry efficacy MEASURED.

`slang-ci-babysitter` drafted + delivered it (comment **`5199334901`**, 01:25:42Z, 7,777 B, author
`nv-slang-bot[bot]`) — Main-verified, and the 07-23 refresh `5062894889` is **untouched**
(`updated_at == created_at == 2026-07-23T20:10:49Z`), so this is a new artifact, not an overwrite.
Approach: in-job conditional retry of the whole suite, gated on the tracked test being the sole failure.
Next: maintainer applies + runs `extras/formatting.sh`.

⭐⭐⭐**RERUNS OF THIS FLAKE GO GREEN — 4/5, and it is THIS signature.** Main-verified all four
independently (`.../runs/<id>/attempts/1/jobs`): `30817212043` att2, `30974153371` att2, `30973012280`
att2, `31032875535` att3 — **every one `conclusion=success` with attempt-1 failed jobs exactly
`["test-falcor / Test (Falcor)", "check-ci"]`.** Log-confirmed on two: `GBufferRTTexGrads`×3,
`3221225477`×1, `renderpasses/test_GBufferRTTexGrads_d3d12 : FAILED`, and `HSigmoid` `[ OK ]` on **both**
D3D12 and Vulkan ⇒ the stored discriminator holds; not the fp16 red. **So "add retry logic" is the right
remedy, not a coin-flip.** Sample is biased (runs the babysitter had already chosen to rerun) and stated
as such; the one non-recovery is #12341's SLANGWIN5, a different defect.

⛔**These are `event=pull_request` reruns — a population this file's merge-queue eviction analysis never
covered.** My own "only 5 reruns fired" figure is *repo-wide, from the babysitter's action log*, and I
briefly mis-read it as evidence no retry sample existed. See
[[feedback_retry_efficacy_gate_has_no_clean_negative_sample]] for the correction.

⛔⭐⭐**`run_image_tests.py` PRINTS NO PASS/FAIL TALLY — Main-verified.** The only numeric lines are
`Running 120 tests on 4 processes` and `[==========] Running 811 tests from 112 test suites.` (unit
tests); the trailer is bare `Image tests FAILED (702.7 s).` ⇒ **the `109P/1F`-style figures in our notes
were OUR OWN summaries read back as if they were tool output** (babysitter-caught). Consequence for the
gate: with no tally, *"few failures"* is indistinguishable from *"most tests never ran"*, so the
sole-failure gate MUST cross-check against the `Running N tests` line or a truncated/empty log
false-passes it.

⛔**Do NOT anchor a log matcher on a `renderpasses/` prefix or a fixed column** — the babysitter caught
itself inventing that prefix, which would have false-negatived on every real log.

**01:32Z follow-up posted** — comment **`5199374294`** (2,339 B). Issue now at **4 comments**, still OPEN,
assignee `jkiviluoto-nv`, `updated_at 2026-08-06T01:32:45Z` (Main-verified). It adds the
`retry-on-gpu-failure` **precedent framing** (rejected as the implementation layer, used to show the ask
is conventional). Babysitter strengthened my claim from *predicate doesn't match* to **structurally
cannot match**, checked at both ends: `ci-falcor-test.yml` defines neither step name, the real failing
job's steps are `setup-falcor / Copy Slang to Falcor / falcor-unit-test / falcor-image-test`, and
`GPU health check`/`GPU post-test diagnostics` exist only in `ci.yml`,
`ci-rhi-test-container.yml`, `ci-slang-test-container.yml`. Line refs pinned: `check-ci`'s `exit 1` at
`ci.yml:708`, `retry-on-gpu-failure` at `ci.yml:716`.

✅⭐⭐⭐**01:37Z — ARTIFACT RATIONALE PUBLICLY RETRACTED (comment `5199404971`), and the retraction is
CORRECT. Main-verified both halves.** A test-only `gh run rerun --failed` **does** resolve
`slang-tests-windows-x86_64-cl-release` today; the pre-#11605 attempt-scoping worry does not apply.

Per-attempt `started_at` for `build-windows-release-cl-x86_64-gpu / build` is **byte-identical across
attempts** ⇒ it never re-executed:

| run | att1 | att2 | att3 |
|---|---|---|---|
| `30817212043` | `13:21:13Z` | `13:21:13Z` | — |
| `30974153371` | `04:09:51Z` | `04:09:51Z` | — |
| `30973012280` | `03:46:37Z` | `03:46:37Z` | — |
| `31032875535` | `18:09:11Z` | `18:09:11Z` | `18:09:11Z` |

…while `test-falcor / Test (Falcor)` **did** re-execute with a fresh timestamp and flip to success —
`30817212043`: att1 `14:02:32Z` failure → att2 `16:14:54Z` success. `31032875535`: att1 `18:46:35Z` fail
→ att2 `20:11:51Z` fail → att3 `00:17:43Z` success. ⇒ **the download step re-ran alone and got the
artifact.** ⭐⭐**The experiment was already in hand — the same four runs used for the retry rate answer
the artifact question one field over (`started_at`), which is why "unverified" was the wrong resting
state for a load-bearing claim.**

⛔**MY OWN NEAR-MISS while checking this — `test-falcor` expands to TWO jobs: `Test (Falcor)` and
`Test (Falcor Perf)`.** A `select(.name|startswith("test-falcor"))|... |head -1` returned
**`att1 falcor: success`** because *Falcor Perf* sorts first — flatly contradicting the real
`Test (Falcor)` failure. Had I not cross-checked against the earlier failed-jobs query I would have
"refuted" a correct retraction. ⇒ **Match `Test (Falcor)` exactly, or print all matches; never `head -1`
a prefix that covers two jobs.** See [[feedback_head_1_on_a_two_job_prefix_inverts_the_verdict]].

⇒ **Consequence noted by the babysitter and worth preserving: this makes the run-level route MORE viable
than its comment implied, not less.** Approach A recommendation unchanged; one supporting reason deleted.

✅**The "stale index" caveat is RESOLVED — the source was right about a DELETED file.** The note/DeepWiki
answer describing `falcor-test.yml` as pwsh + `$ErrorActionPreference` was accurate: that file existed and
was **removed in #11605 (`6fac3e6d0`, "Reuse ci.yml artifact for Falcor tests")**, confirmed via
`git show 6fac3e6d0^:.github/workflows/falcor-test.yml` → `shell: pwsh` ×3, `$ErrorActionPreference` ×2.
**The filename also changed** (`falcor-test.yml` → `ci-falcor-test.yml`), which is why a path-scoped
`git log` on the current name looks empty. ⇒ The `download-artifact` attempt-scoping rationale derived
from it is **not** based on a hallucination, but it IS based on the pre-#11605 design — so it still needs
re-deriving against the bash successor before anyone states it as fact.
See [[feedback_stale_index_describes_a_real_deleted_file]].

## ⛔⭐⭐⭐ 2026-08-05 — GREPPING `0xC0000005` RETURNS **ZERO** ON A GENUINE OCCURRENCE. The log prints DECIMAL only.

Babysitter-found, Main-verified on a real eviction (merge_group run `30957913120`, PR #12322, job
`92160182855`):

```
grep -ic '0xC0000005'    → 0        ← the hex form appears NOWHERE
grep -c  '3221225477'    → 1        ← Mogwai prints the DECIMAL return code
grep -c  'GBufferRTTexGrads' → 3
```

⇒ ⛔**A hex probe for this signature silently mis-attributes the failure** — it returns a confident zero on
the exact occurrence it was written to find, so the crash gets classified as something else (or as
unclassified) while the real signature is right there in decimal.

✅**Probe on `3221225477` OR on the test name `GBufferRTTexGrads`.** The test name is the more robust key —
it survives a runtime that changes how it renders the code.

⭐⭐**Why this is worse than an ordinary bad needle: the hex form is the CANONICAL way to write this value**
(`0xC0000005` = `STATUS_ACCESS_VIOLATION`), so it is exactly what a knowledgeable reader types, and what
this store's own prose uses. **Domain fluency selected the wrong needle** — the human-canonical spelling
and the emitted spelling differ, and only the emitted one is greppable.

⚠️**Blast radius in this store: the hex form appears in 8 files** (`feedback_filter_latest_returns_two_suites_per_sha`,
`project_12099…`, this file, `project_12204…`, `project_12210…`, `project_12273…`, `project_9403…`,
`project_slangwin5_spirv_val_runner_defect`). Those are fine as *prose describing the crash class*; they
are wrong the moment anyone lifts one as a **search pattern**. ⇒ **When a note names a value that also gets
grepped, record the EMITTED form beside the canonical one.**


# #12145 — GBufferRTTexGrads_d3d12 access-violation CI flake (ANCHOR)

Durable CI-infra flake anchor, bot-authored by nv-slang-bot[bot] (Infra, CI
Stability), opened 2026-07-17. Same class as [[project_12137_aarch64_apt_fetch_ci_flake]].

**Signature:** `renderpasses/test_GBufferRTTexGrads_d3d12` FAILED — `Mogwai.exe`
exits **3221225477 = 0xC0000005 (STATUS_ACCESS_VIOLATION)**. D3D12 only, single
renderpass; all other ~100 Falcor tests pass on D3D12+Vulkan same run.

**Discriminator (critical):** in every occurrence `ActivationFunction_HSigmoid`
**passes** on both D3D12 and Vulkan → this is NOT the known HSigmoid fp16
numeric-tolerance red (0.0025 tol, Falcor-CI-maintainer-owned, non-actionable).
This is a genuine process crash in Mogwai on GBufferRTTexGrads specifically.

**Cost:** dominant Falcor merge-queue evictor 07-15→07-17 — 8 evictions/head-reds
across 8 unrelated PRs (#12009, #12052, #11979, #12126, #12064, #12055, #12105,
#12144). Run IDs in issue body. Crash is PR-code-independent (docs, generics,
reflection, autodiff, Metal, mimalloc all hit it) → confirmed test/infra flake.

**Ask:** maintainer fix-or-quarantine the GBufferRTTexGrads renderpass.

**07-23 20:11Z IMPACT-REFRESH POSTED (babysitter, comment 5062894889).** Issue OPEN, assigned jkwak-work, zero prior comments → non-duplicative. Babysitter re-derived from durable log (excluded 5 false matches — #12089's Falcor red is author-owned E41011 `hlsl_nvapi` link, GBuffer only "PASSED" there): **44 attributed occurrences / 16 PRs / 07-15→07-23, of which 34 merge-queue evictions across 9 PRs** (#12122 ~13×, #12151 ~12×) + receipts table extending the original 8-row body. Explicit quarantine ask on `test_GBufferRTTexGrads_d3d12`. Babysitter flagged DONE — won't re-post per-sweep; next #12145 update only if cost materially shifts (starts stranding, or count ~doubles). Quarantine ask also standing with operator (not re-pinged per-sweep). Fix-owner = jkwak.

## ⚠️ 2026-08-03 18:2xZ — ESCALATED TO OPERATOR. 17 days open, 9 days no owner activity, ZERO fix PRs.

**Main-verified via REST this session:** `state=open`, labels `Infra` + `CI Stability`, assignee **`jkwak-work`**, created `2026-07-17T12:18:31Z`, **`updated_at` `2026-07-25T19:18:33Z`** ⇒ **untouched 9 days**. Comments: exactly **one**, `5062894889` (`nv-slang-bot[bot]`, 07-23) — the impact refresh above.

⚠️ **Operational consequence — the sole comment here is OUR OWN, so any refresh is an
`EDIT-IN-PLACE` (`PATCH /repos/shader-slang/slang/issues/comments/5062894889`), never a second
`POST`.** A new comment would be a bot-on-bot echo on an issue whose comment count is the debounce
signal. Paired rule from #8785: **re-read the body live immediately before editing** — a changed
body is a signal to VERIFY, not to overwrite. (Recorded 08-04: this consequence existed only in the
MEMORY.md index line, which a compaction pass was about to shorten away — a Mode 4 near-miss.)

**ZERO fix work in flight — Main-verified, not inferred:** `search/issues repo:shader-slang/slang 12145 type:pr state:open` → **total_count 0**. `GBufferRTTexGrads type:pr` → 8 hits, **all closed and all unrelated** (#12152 hpp prototypes, #12289 CUDA `Buffer<T>`, #12151 public-by-default, #11665 operator names, #12122 profile/capability conflict). Nothing is being worked.

**Scale now 16 distinct PRs over 7 days** (babysitter, corrected method) — still the **single dominant merge-queue evictor**. The one failed merge_group batch repo-wide in 26h (run `30818074297`, #11667) was this class; auto-requeued, three later batches green, nothing stranded.

**Escalated because the bot's own channel is exhausted:** the 07-23 comment already made the quarantine ask, and the babysitter's debounce policy correctly forbids re-posting until cost materially shifts. A second bot nudge would be noise ⇒ **this needs a human**, which is exactly the case for an operator escalation rather than another GitHub write.

⛔ **Do NOT dispatch a fixer.** `Infra`-labelled, maintainer-assigned, and quarantining a test touches CI workflow YAML that the bot **cannot push** ([[project_bot_workflows_permission]]). The ask stays "maintainer fix-or-quarantine."

> ⚠️ **SUPERSEDED 2026-08-06 — see the maintainer-decision section at the top of this file.** The
> paragraph above stands only as the record of why the route was closed 08-03→08-05. `jkwak-work`
> has since decided the approach (scoped retry) and reassigned to `jkiviluoto-nv`, so drafting IS
> now in scope; the unpushable-YAML half remains true and is why the deliverable is a diff comment
> rather than a PR.

## ⚠️ The babysitter's ranking metric was BROKEN — treat prior "top signature" lines as unreliable

Of **143** records logged `action:"rerun"` in 7 days, only **5 were real reruns**; **138** were re-confirmations / refusals / moot deferrals mislabeled. It had ranked `check-formatting` **#1 at 31 hits** — all 31 re-confirmations of two author-owned PRs that were never rerun and never should be. Fixed: non-actions log `action:"none"`; ranking derives from reason-text by **distinct-PR spread**.

**#12145's dominance HOLDS under the corrected method** — the bug inflated a benign signature to #1 but did not manufacture #12145. ⭐**Generalizable: a counter that conflates "I considered X" with "I did X" ranks attention, not action.** Same non-discriminating-signal family as the rest of 08-03 — the count couldn't distinguish the two states it was summing.

## ⚠️ Log trap — GPU-health text is ECHOED workflow script, not a failure

Slang GPU jobs **echo** `"::error::GPU health check failed… Re-run to get a new VM"` and `nvidia-smi FAILED` **as workflow script text**. A keyword grep reads these as GPU flake. On **#12182** the real failure was a deterministic **OptiX symbol collision** (`OPTIX_ERROR_PIPELINE_LINK_ERROR`) across **8 runners / 2 OSes** — author-owned, not infra. **Discriminators are selectivity (327 passed / 1 failed) and runner spread, never keywords.** Same "the log's text doesn't mean what it says" family as [[feedback_green_job_skipped_backend_zero_coverage]].

**Routing:** forwarded to `slang-ci-babysitter` (owns CI-flake anchors) to
register #12145 as canonical anchor for this signature — use for future
flake-vs-real classification and safe requeues. Bot-authored + maintainer-directed
→ Main did NOT post a GitHub ack (bot-to-bot noise); babysitter owns the GH surface.
Thread: `gh-issue-shader-slang/slang-12145`.
