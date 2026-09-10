---
name: feedback_a_cap_that_is_slack_at_rest_binds_when_the_state_changes
description: "A page-1-of-100 cap I documented as a KNOWN, SAFE bound was safe only because the population was suppressed by the very condition the guard exists to watch end; when CI un-suppresses, the population crosses 100 in the SAME event, so the probe goes blind exactly when the signal arrives. Also: `gh --paginate` SILENTLY TRUNCATES under the OneCLI proxy (100 rows + exit 1) because rel=next uses the /repositories/<id>/ path form, which 401s while /repos/owner/name/ succeeds."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6f93e559-d28a-456e-80e8-cc86237acf6b
---

# A cap that is slack at rest binds exactly when the state changes

Measured 2026-08-07 09:4xZ on guard `i12371-pr-guard-0175` (slang#12371, draft PRs #12382/#12408).

## The defect I had DOCUMENTED as safe

At 15:0xZ 2026-08-06 I added three PR-side probes and wrote the bound down deliberately:

> ⚠️ Known bound, deliberate: the three counts are `per_page=100` page-1 only — a change *within* a
> >100 regime would be dark, though any crossing into it differs from the stored value and wakes.
> **Fine for a 3-commit draft.**

The check-run read had the same shape (`check-runs?per_page=100`, page 1, no completeness check).
**"Fine for a 3-commit draft" was true and irrelevant.** The population that matters is not the
commit count — it is the **check-run count**, and I never asked what governs it.

⛔ **What governs it is the exact condition this guard exists to watch end.** Both PR heads carry
only 84 and 36 check-runs *because every build/test job is SKIPPED by the priority gate*
(`wait-for-human-priority` yields bot CI to human CI). Master head `6330a678` — a head where CI
actually ran — carried **112, then 122, then 129** during this one session. So:

- At rest (CI suppressed): 84 rows, cap has 16 rows of slack, probe complete.
- The moment `ci-retry-yielded-bot` requeues and real jobs run: the head enters the **>100 regime**,
  page 1 holds the **newest** runs (verified: page 1 `started_at` 10:04:23Z→07:44:56Z, page 2
  07:43:10Z→07:39:10Z), and a failure on an **older-started** job sits outside the window.

⭐⭐⭐ **The event that produces the signal and the event that blinds the instrument are the SAME
event.** A real build failure can only appear once CI actually runs; CI actually running is what
pushes the count past the cap. So the probe is complete for exactly as long as there is nothing to
see, and truncates the instant there is. **A cap validated against the resting population is not
validated at all** — the resting population is the one state where the cap cannot fail.

⇒ **Before writing off a cap as slack, ask what SUPPRESSES the population today, and whether that
suppression is the thing being waited on.** If yes, the cap is not a bound — it is a fuse.

## `--paginate` does not fix it here, and fails success-shaped

The obvious remedy was `gh api --paginate`. **It silently truncates in this container.** Measured, 3
trials each on the identical URL:

| method | rows | exit |
|---|---|---|
| `gh api --paginate ".../check-runs?per_page=100"` | **100** | 1 |
| explicit `&page=1` + `&page=2` loop | 100 + 22 = **122** | 0 |
| `total_count` probe | **122** | 0 |

Mechanism, pinned rather than guessed: page 1's `Link:` header gives
`rel="next"` as `https://api.github.com/repositories/93882897/commits/<sha>/check-runs?page=2` — the
**numeric-repository-id path form**. Under the OneCLI credential proxy that form **401s**
(`app_not_connected`), while the `/repos/owner/name/...` form succeeds. Verified directly, isolating
the path form from the page number:

- `gh api repositories/93882897` ⇒ **401** `app_not_connected`
- `gh api repos/shader-slang/slang` ⇒ works
- `gh api "repos/.../check-runs?per_page=100&page=2"` ⇒ **22 rows**
- `gh api "repositories/93882897/.../check-runs?per_page=100&page=2"` ⇒ **401**

So `--paginate` follows a link its own credentials cannot use. It writes page 1 to **stdout**, the
401 to **stderr**, and exits 1 — and every call site here already had `2>/dev/null`, so **the
failure was invisible and the partial data looked complete.** Not specific to check-runs: repo-wide
`pulls?state=open` gave `--paginate`=100 vs explicit=200.

⭐⭐ **A tool that truncates on stdout while erroring on stderr is indistinguishable from a small
result set.** ⇒ ⭐⭐⭐ **The only defence is `rows == total_count`, enforced as a GATE, not an
ad-hoc check** — the same rule as [[feedback_a_denominator_hunt_silently_asserts_the_numerator]] and
the store-maintenance rule *"a tool that silently collapses output reports a TRUE NUMBER ABOUT A SET
YOU NEVER SAW."*

## What caught it

Not the field-set review that found the previous six defects. **The completeness control** — the
habit of printing `total_count` next to the returned row count — which I had been running by hand on
this chain since 08-06 11:1xZ purely as an instrument check. It was in the transcript as
`total_count=112 returned=100` and the mismatch is what I noticed.

⭐⭐⭐ **The six prior fixes were all "which FIELDS do I watch"; this one is "is the READ of a field
I already watch complete".** Widening a field set cannot find it — the field was present, the probe
ran, and it returned a plausible answer about a subset. ⇒ **For every probe, two separate questions:
(1) does the fingerprint carry this field, (2) does the read of it cover the whole population?** I
had asked (1) six times and never asked (2).

## Fix and tests

Replaced the single-page read with an explicit `&page=N` loop over the `/repos/owner/name/` path form
(max 12 pages), preceded by a `total_count` probe, and gated on `rows == total_count` — a shortfall
**bails without touching the latch**, like every sibling probe.

Eight tests, latch md5 `d829f9d5…` verified byte-identical after each failure case:
- **T1** normal fire ⇒ silent, latch identical (rewrite is behavior-neutral at rest).
- **T2** `total_count=150`, page 2 empty ⇒ bails naming **`rows 84 != total_count 150`**.
- ⭐**T3 RETROACTIVE control** — page 1 = 100 skipped rows, page 2 = 21 success + **one
  `build-linux-x86_64-release / build` failure** ⇒ **wakes and names it.** The old page-1-only read
  reported zero failures on this exact input. *This is the test that proves the fix catches the dark
  event rather than merely being present.*
- **T4** `total_count` = error object ⇒ bail · **T5** page 1 = error object ⇒ bail · **T6**
  `total_count` = injected junk (`; rm -rf /`) ⇒ bail. All three latch-identical.
- **T7** positive control (seeded different fp) ⇒ still wakes, so the gate is not dead.
- **T8** final unstubbed fire ⇒ silent, latch identical.

⚠️ **Two stub-authoring traps, both of which produced a PASS for the WRONG REASON** and would have
certified an untested gate:
1. `case` glob `*per_page=1*` **prefix-matches `per_page=100`**, so my stub hijacked the page calls
   too and the bail came from the array shape-check, not the completeness gate. Anchor the pattern
   (`*check-runs\?per_page=1`).
2. The guard calls `gh api --jq`, so a stub must emit **post-jq output** (a bare array), not raw API
   JSON. Emitting `{"check_runs":[]}` tripped the type check instead of the row count.
⇒ ⭐⭐ **When a failure-injection test bails, read WHICH guard fired. A bail is not a pass; a bail
from the wrong guard means the one under test never executed.** Both near-misses here.

⭐⭐ Restored `lastwake` to the true `1786096807` after testing — **a test of a budgeted mechanism
must not consume the budget it measures** (4th time on this guard).

## Sibling audit

Grepped all 7 guard scripts: **only this one reads check-runs** (plus `pr12200-guard.sh`, which
**already** loops explicit pages and gates on `rows != total_count` — I wrote that one correctly and
then didn't carry the pattern across). The three `--paginate` users
(`sweep12375-guard.sh`, `guard-11965.sh`, `guards/i12092-scope-guard.sh`) all paginate **issue
comments** whose populations are **3, 3, 0** — the truncation is latent there, not live.
⭐ **I had the correct pattern in my own tree the whole time.** ⇒ when fixing an instrument, grep
your own prior work for the same read before designing a fix.

See [[project_12371_spirv_prelink_validation_buffer]],
[[feedback_a_latch_its_own_failure_path_can_write_is_not_a_latch]],
[[technique_keeping_this_store_reachable]].
