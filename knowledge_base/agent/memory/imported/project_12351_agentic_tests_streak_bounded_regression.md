---
name: project_12351_agentic_tests_streak_bounded_regression
description: "slang#12351 (bot-filed, OPEN, unlabeled, 0 comments): 'Nightly agentic-tests has never passed in retained history (>=36 nights)'. Main-measured 2026-08-04: the never-passed claim is FALSE and the >=36 FLOOR INVERTS to an exact bounded 36 — 16 passes exist under retired workflow id 287019999 (rename #11828 minted new id 304423282), last pass 2026-06-29, first fail 2026-06-30, window = 15 commits 3a84a12b8e..80bf926b57. Rename measured non-causal (name + comment only). Suppression list is 24 entries, not 195. Correction dispatched to slang-ci-babysitter on gh-issue-shader-slang/slang-12351."
metadata: 
  node_type: memory
  type: project
  title: "slang#12351 — agentic-tests streak is bounded, not beginningless"
  tags: 
    - slang
    - ci
    - agentic-tests
    - nightly
    - live-chain
    - correction
  originSessionId: ac138413-f175-4e9e-a8ba-3d61754cbb89
---

# slang#12351 — the streak has a START, and the suite has passed

**Filed by `nv-slang-bot[bot]` 2026-08-04. State at handoff: OPEN, no labels, no assignees,
0 comments.** Almost certainly authored by `slang-ci-babysitter` (cross-refs #12341/#12342, its
same-day chains).

The report's core measurement reproduces exactly; its **conclusion does not survive**. I checked
before routing because a peer's count carries no provenance.

## What is right in the issue

- ✅ Scope caveat is correct and valuable: one job, `agentic-tests`, running
  `slang-test -test-dir docs/generated/tests` — the LLM-generated bundles, **not** `tests/`.
  No compiler regression implied. Keep this framing.
- ✅ Not host-scoped: sampled runner ids all distinct.
- ✅ The advisory-signal argument ("an always-red advisory signal carries no information") is the
  right reason to file.
- ✅ Bidirectional gate is real: 10 failing **plus 5 listed-expected-fail that now PASS**, so
  appending to the suppression list cannot clear it.
- ✅ The no-hand-edit routing (regenerate / fix source doc / manifest → `mark-fresh`) matches
  `_meta/regenerate.md` and the shared learning
  `1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md`.

## What is wrong

**1. "Never completed successfully in retained run history" — FALSE.**
16 successes exist. They sit under retired workflow id **287019999**
(`ci-agentic-tests-nightly.yml`, name "Agentic Tests (Nightly)", `state: deleted`, **absent from the
`actions/workflows` listing**). Rename `cf5d225f8c` (#11828, 2026-06-30T02:37:22Z) minted the new id
**304423282**. Full mechanism + recipe:
[[technique_workflow_rename_mints_new_id_old_id_deleted]].

**2. The `≥36` floor inverts.** The issue hedged that the streak might be *older* than 36 because the
API "cannot distinguish 'workflow created then' from 'older history purged'." It can — via
`previous_filename`. The streak is **exactly 36 with a known boundary**, which is strictly more
actionable than the floor:

```
last PASS : run 28350804872  2026-06-29T05:31:48Z  head 3a84a12b8e   (old id 287019999)
first FAIL: run 28422435803  2026-06-30T05:26:38Z  head 80bf926b57   (new id 304423282)
window    : 15 commits, 98 files  (compare 3a84a12b8e...80bf926b57)
```

**3. The rename is NOT the cause** (checked, since it is the obvious suspect). Its entire patch to the
workflow is `name: Agentic Tests (Nightly)` → `name: Nightly Slang Test` plus one comment line
referencing the renamed coverage workflow; the only other relevant edit is comment prose in
`_meta/agentic-coverage-excludes.txt`. No `uses:`, no `-test-dir`, no path change.

**4. "expected-failures.txt (currently 195 lines)" overstates ~8×.** 195 total = **155 comments +
16 blank + 24 entries**. The bidirectional-gate conclusion still holds; only the figure is wrong.

**5. Pre-rename was not healthy either** — do not overcorrect into "green before the rename".
Predecessor was **16 pass / 17 fail**, flapping, worst prior fail streak 8 nights (06-16→06-23).
Honest framing: **the suite always flapped; after 2026-06-29 it stopped flapping into green at all.**
36 consecutive is ~4.5× the worst prior streak — a real change in a noisy signal.

## Candidates in the window (NOT diagnosed — do not publish as cause)

Boundary logs are **410 Gone** both sides, so the drift set cannot be attributed from logs. Of the 15
commits, the diagnostic/IR-touching ones fit the two known staleness classes in the shared learning:
`c21ead2690` improve character/string literals (#11714) · `51959e21ff` warn on copy of uninitialized
value (#11764) · `6b473bdfbe` validate generic struct capability reqs (#11770) · `e248123ba9`
`[require]` caps on inverse-placed derivatives (#11558) · `80bf926b57` qualify extension-method name
hints (#11581) — that last one is exactly the **IR-LABEL mangled-name drift** class, and
`c8897a19fd` (GLSL array-constructor syntax) could move target-pipeline CHECKs. Annotations survive
the 410 but carry only `Process completed with exit code 1` — per
[[technique_annotations_survive_log_expiry_step_relative_line]] that surface never carried
diagnostics. **A local `slang-test -test-dir docs/generated/tests` run at the boundary shas is the
only way to attribute; today's run log is alive and is the cheaper start.**

## Also note

The 07-09 reconciliation (`08af86542f`, #12017, "update round … against the regenerated design docs")
**did not restore green** — ⛔**25 failure / 1 cancelled / 0 success** (babysitter-caught; **my 26 was
off by one — I filtered `created_at>"2026-07-09"` when the merge was `09:03:26Z`, so I counted that
night's `05:22:16Z` run, which ran BEFORE the fix landed**) ⇒ ⭐⭐**a date-only boundary silently
includes pre-event rows when the event has a TIME — compare against the full timestamp, and a
same-day run is on the wrong side of a mid-day merge.** ✅**Stronger than a bare touch: #12017 was
`+24/−0` to that file ⇒ it CREATED the entire current 24-entry suppression set**, and still 0 success
after it. So this is not a
never-attempted chore; a prior reconciliation already failed to hold. Worth saying so, or a maintainer
will reasonably ask why the same fix should work now.

Related: [[project_12326_throw_statement_missing_semicolon]] measured the same blindness from the
other side (a merge landing green because this dir is nightly-only), and found the "Lint on PR" check
that `regenerate.md` names as the intended attachment point **does not exist**. Also
[[project_11988_nightly_spvopt_workflow_parked]] (different nightly, same file family).
[[feedback_green_job_skipped_backend_zero_coverage]] is the shape.

## State

Correction dispatched to **`slang-ci-babysitter`** (closest-to-the-state: it holds the issue and owns
the GitHub comment) on canonical thread `gh-issue-shader-slang/slang-12351`. Asked for an **in-place
body edit**, not a new comment — the issue is bot-authored with 0 comments, so the wrong numbers are
still the only public artifact, and #12341's republished-refuted-claim episode is the precedent for
fixing the artifact rather than appending a retraction.

⚠️ **I did NOT dispatch a fixer.** Remedy is operator/maintainer-gated by the no-hand-edit policy;
route (2) "fix the source doc" is a separate PR per `regenerate.md`.

## Update 08-05 18:2xZ — chain RE-OPENED by a human comment; no bot post (unauthorized)

`jhelferty-nv` [commented `5195600621`](https://github.com/shader-slang/slang/issues/12351#issuecomment-5195600621):
**"@jvepsalainen-nv Is this expected?"** — addressed to the **suite owner**, not to us.

- ⛔**The `github.pr_mention` webhook was a FALSE POSITIVE** — `grep -ci nv-slang-bot` on the body = **0**
  ⇒ no mention, no `<github-post-authorized />`, **no bot comment.** (Same false-positive shape as
  #11988's 07-08 event, already recorded in [[project_11988_nightly_spvopt_workflow_parked]].)
- ✅**Ownership confirmed by measurement, not assumption:** `jvepsalainen-nv` authored **14 of 17**
  commits under `docs/generated/tests` and **all 7** touching `_meta/expected-failures.txt` ⇒ he is the
  right addressee; interjecting into a question aimed at him would be noise.
- ⚠️**Short of our own stated resumption trigger.** Our comment `5186113055` named *"a maintainer
  comment here choosing a route"*; "Is this expected?" **asks about state, it does not choose a route.**
  Our answer to his actual question is already public one comment up (advisory suite, not `tests/`, no
  compiler regression, needs a route decision).
- ✅**Our published comment made a FALSIFIABLE PREDICTION and it RESOLVED — verified:** it said
  *"tonight's run lands ~05:05Z and will make it 37 unless something changed."* Run **`30977023222`**,
  `2026-08-05T05:05:01Z`, `schedule`, **failure** ⇒ population now **37 = 36 failure + 1 cancelled**,
  `total_count 37 == 37 returned`. ⭐⭐**A published prediction is an obligation to check back: it is the
  one number on the artifact that goes stale on a KNOWN SCHEDULE, and the check costs one call.**
- ⚠️**Stale-by-one, not wrong** ⇒ an in-place refresh is hygiene, and per
  [[feedback_an_in_place_edit_notifies_nobody]] it will **not** reach jhelferty. Since posting anew is
  unauthorized here, that tension resolves toward: refresh in place, do not post. **Handed to
  slang-ci-babysitter** (closest-to-the-state; it owns comment `5186113055`).

### 08-05 18:2xZ — refresh landed; the DRIFT SET MOVED (I verified from both logs, did not relay)

✅**Title+body refreshed in place, still 2 comments, no new post.** Live: *"red **37** consecutive
nights"*, `~4.6×`, `27 runs` post-#12017, segments **28 + 8**, and the failing/stale lists now labeled a
**snapshot, not a fixed work item**.

⛔⭐⭐⭐**The substantive finding is theirs and it FALSIFIES a claim the issue published: "a small,
stable drift set … prior nights are consistent" is FALSE — the set moved overnight.** I diffed the two
run logs myself (`30879595238` 08-04 vs `30977023222` 08-05), both fetched, both `200`:

| | 08-04 | 08-05 |
|---|---|---|
| summary | `4554/4583`, 19 expected-fail | `4552/4583`, 20 expected-fail |
| failing | **10** | **11** |
| stale-pass | **5** | **4** |

Failing-set diff (exact): **+`hlsl/nvapi-guard-present-without-nv-intrinsic.slang`**,
**+`hlsl/prelude-nvapi-include-conditional.slang`**,
**−`design/pipeline/02-parse-ast/builtin-op-matrix-operands.slang (cpu)`**. Stale-pass diff:
**−`design/ir-reference/decorations/struct-with-many-field-decorations.slang`** (cleared).
⚠️Also present both nights and NOT in the issue's original list: `unsafe-force-inline-early-decoration`,
`swizzle-emit-multi-target.slang.4`, `nvapi-guard-with-wave-intrinsic` — the original body abbreviated
3 as `{hlsl,metal,wgsl}/…`.

⭐⭐⭐**Their corollary, and it is the keeper: a CHARACTERIZATION inferred from 2–3 samples ("stable",
"consistent", "steady-state") is the FIRST thing to re-test when sample N+1 lands — because the COUNT
is visible and the CHARACTERIZATION is not.** A maintainer scoping work off "stable" would have
mis-sized it; that mattered more than the counter tick. ⭐⭐**And a bump is not a find-and-replace: 36→37
left THREE derived figures stale in different populations** (the ratio; the post-#12017 tally 26→27,
a *different* population that also grew; and the falsified characterization) ⇒ **enumerate what DERIVES
from a number before editing it.**

⛔⭐⭐⭐**MY OWN PROBE WAS DEFECTIVE AGAIN — 3rd instrument defect this chain, same slot (auditing a
peer).** I probed the live body for `4.5` and got **3 hits in a body containing ZERO** — I passed
`4.5` unescaped to `grep -oi`, so `.` matched any char (`4.6`, `4552`, `4583`). **A regex
metacharacter in a literal-string probe INFLATES, where the earlier `grep -oic`-after-`tr` bug
FLATTENED to 1** ⇒ ⭐⭐⭐**both directions of a broken probe read as a plausible number; escape the dot
(`grep -oF` or `4\.5`) and sanity-check any count against a `grep -n` that shows you the LINE.**
✅Resolved by re-running literal: `4.5`→**0**, `4.6`→**1**. Body was clean; my instrument wasn't.

### 08-21 13:04Z — ✅ CLOSED `completed` by `jvepsalainen-nv` ("Fixed. Closing."). TERMINAL. No bot post (false-positive `pr_mention`, 0 mentions; maintainer closing own issue).

All three named PRs merged: **#12571** (08-17), **#12573** (08-17), **#12539** our-bot unorm fix (08-19).
**First GREEN nightly since 2026-06-29 landed 08-19** (run population: 08-19 success / 08-20 cancelled /
08-21 failure). ⚠️**08-21 is red AGAIN but it is the KNOWN-ACCEPTED residual, verified not a new cause:**
run `32446287510`, `6277/6302`, **1 failing** = `module-roundtrip-preserves-public-symbol.slang.1`, a
single rotating test with **12 transport-fault signatures** (malformed/rpc-failed/pending-retry) in the
log ⇒ the #12534 flake profile that **#12573 mitigates but does not fix** (#12534 stays open by design).
⭐**Closing an issue `completed` while a mitigated-not-fixed flake still reds the odd night is CORRECT —
the TRACKED problem (drift / always-red-carries-no-signal) is gone; the residual is a different, tracked,
non-blocking cause.** ⇒ **Do not reopen #12351 for an 08-2x red unless it's a NON-transport, repeating
failure.** Chain fully closed; superseded sections below are history.

### 08-17 — RESOLVED by the maintainer; the drift this issue documented is fixed. No bot post (false-positive `pr_mention`, 0 mentions).

`jvepsalainen-nv` chose a route on 08-05 (comment `5240462238`) and then EXECUTED it; his 08-17 `[Agent]`
status (`5314559252`) reports the outcome. **Main-verified the load-bearing parts, not relayed:**

- ✅**Drift mechanism RESOLVED.** [PR #12531](https://github.com/shader-slang/slang/pull/12531)
  ("Agentic tests: consume doc gaps and update tests") **merged 2026-08-14** to master — regenerated the
  bundles against current language. Every failure in this issue's original table is gone.
- ✅**Suite recovering, still red for a DIFFERENT reason.** Latest cited run
  [`31993906894`](https://github.com/shader-slang/slang/actions/runs/31993906894) (08-17, `workflow_id
  304423282`) = `failure`, but **2 failing / ~6300** (was 20 / ~4600); suite grew ~1700 tests so the
  *rate* fell further than the count. Red because 2>0, not because of drift.
- **Remaining redness = 3 non-drift causes, all maintainer-or-bot owned:**
  - **#12442** HLSL prelude leak (render-test blanks the prelude on the shared global session) → 5th
    victim `nvapi-front-matter-defines-enable-macro.slang`, deterministic. [PR #12571] records it.
  - **#12534** test-server malformed replies (transport flake, ~7–8/run, rotates — disjoint failure sets
    on an IDENTICAL SHA is his proof it's not a test defect). [PR #12573] retries on a fresh server;
    **mitigates, does not fix** #12534.
  - **#12535** unorm/snorm `SIGSEGV` (`ModifiedType` missing in `slang-type-layout.cpp` → fell to
    `SLANG_ASSERT(!"unimplemented…")` = `__builtin_unreachable()` UB under Release/GCC; segfaults Linux,
    clean exit macOS/Clang). ⭐**Fixed by [PR #12539](https://github.com/shader-slang/slang/pull/12539) —
    OUR OWN BOT's PR** (`fix/issue-12535`, OPEN, `mergeable_state: blocked`, `nv-slang-bot[bot]`).
- ⚠️**#12539 is a slang-fixer chain, NOT this one — do NOT dispatch into it from here** (ANCHOR H:
  no direct Main→fixer on a chain the fixer owns; it routes via its own `fix/issue-12535` branch
  mapping). Noted for awareness only.
- ✅Also filed by him, all `reproduced`: **#12440** getStringHash-nonliteral crash, **#12441** SPIR-V
  invalid modules (sample interp + unorm), **#12442** prelude leak, **#12443** enum `E(N)` in generic
  array-bound. These are the "tests exposing real compiler bugs" — genuine wins the advisory suite
  surfaced, which is exactly what an always-red signal could NOT report (this issue's own thesis,
  vindicated).

**CHAIN RESOLVED on our side.** The tracked problem (drift / always-red-carries-no-signal) is fixed;
#12351 will close when the maintainer closes it or the 3 PRs land and the nightly goes green. No bot
action pending — advisory suite, blocks nothing. Handed the resolution to `slang-ci-babysitter`
(owns comment `5186113055`, closest-to-the-state).

**RESUME** only if: the nightly is still red after #12571/#12573/#12539 all land (a NEW cause), or a
fresh substantive human comment. ⛔Do not post to #12351 without a real `@nv-slang-bot` mention.

**RESUME (superseded)** = `jvepsalainen-nv` replies (route choice ⇒ dispatch per his answer), **or** the earlier
triggers below. ⛔**Do not post to #12351 without a
real `@nv-slang-bot` mention.**

**RESUME (original)** = babysitter reports the edit landed (then verify the live body carries 24-not-195 and the
bounded-streak framing, with a single distinctive token, not a multi-word phrase), **or** a human
comments on #12351, **or** a reconciliation PR appears touching
`docs/generated/tests/_meta/expected-failures.txt` → route to slang-reviewer.
