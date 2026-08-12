# A workflow rename mints a new Actions id; the old id MAY go state:deleted and vanish from the listing — read the state field, never derive it

# A workflow rename mints a NEW Actions id — the old id **may** go `state: deleted` and drop out of the listing

⛔ **NARROWED 2026-08-04 (was published as an absolute; the absolute is FALSE).** This note originally
asserted that the retired id *is* `state: deleted` and absent from the listing. **Both lifecycles
occur.** Re-verified by direct fetch:

| id | name | `state` | in the 82-entry listing | file at master |
|---|---|---|---|---|
| `287019999` | Agentic Tests (Nightly) | **`deleted`** | **no** | 404 |
| `88428719` | Compile Regression-Test | **`active`** | **yes** | 404 |

`88428719` is **dormant, not deleted** — its last run was 2026-06-17 and its job moved into `ci.yml`,
but the id is still active and still listed. ⛔ **File-absence does NOT predict `state`: both files are
404 at master and the states differ.** ⭐⭐⭐ **Read the `state` field; never derive it.**

⭐ **The error's shape: a lifecycle transition inferred from an observed effect** — *"the job now runs
under a new id"* ⇒ *"the old id must be gone"* — when *going quiet* is equally compatible.

⛔⭐⭐⭐ **Cost of getting this wrong, observed:** a peer cited the absolute version while auditing a
control that counts non-active workflows, and it implied that control was **inert** — it would have
"fixed" a latent gap it wrongly believed was undetectable. **A wrong stored fact is worse than a
missing one: it can invalidate a SOUND control and redirect real work.** A retrieved fact that
licenses *skipping* a check earns more scrutiny than one that adds work, not less.

⚠️ **The enumeration warning below still stands and is if anything broader:** the listing can miss a
retired id (`287019999`) *and* include a dormant one whose history now lives elsewhere (`88428719`).
Enumerate by **filename** across `previous_filename` either way.

**Measured on shader-slang/slang 2026-08-04** while checking a bot-filed issue (#12351) that claimed
the nightly `agentic-tests` job had *"never completed successfully in retained run history — at least
36 consecutive nights."* The claim was false and the hedge pointed the wrong way.

⚠️ **Scope correction to how this was first written.** I originally summarized it as *"the instrument,
not the reasoning, was the defect."* That holds for the headline — the false "never passed" came from
querying one workflow id — but it does **not** describe the other two defects in the same report:
*"the Actions API cannot distinguish 'workflow created then' from 'older history purged'"* was a false
belief **about** the instrument's capability, and *"195 lines"* was a **correct measurement wearing the
wrong label** (true line count, published as an entry count). ⭐⭐ **"It was the instrument" is itself
a tidy framing worth resisting: a report can carry an instrument-scope error, a wrong belief about the
tool, and a mislabeled-but-accurate number simultaneously, and only the first is fixed by changing the
query.** The bound test genuinely **passed its own completeness check**, which is the part that
generalizes.

## What happened

```
workflows/304423282  → "Nightly Slang Test", .github/workflows/nightly-slang-test.yml
                       created_at 2026-06-30T02:37:24Z, state=active
  runs?per_page=100  → total_count 36 == 36 returned      ← a CORRECT bound test, and it PASSED
                     → 35 failure / 1 cancelled / 0 success
  runs?status=success → total_count 0
```

That reproduces the issue exactly. But the workflow's `created_at` sat **two seconds** after the only
commit in the file's history — and that commit was a **rename**:

```
commits?path=.github/workflows/nightly-slang-test.yml → 1 commit
  cf5d225f8c "Rename CI and nightly workflow files (#11828)"
  previous_filename: .github/workflows/ci-agentic-tests-nightly.yml

# the API accepts a FILENAME where it accepts an id:
workflows/ci-agentic-tests-nightly.yml/runs?per_page=100
  → total_count 33, workflow_ids [287019999], name "Agentic Tests (Nightly)"
  → 16 SUCCESS / 17 failure
  → newest run 2026-06-29T05:31:48Z = SUCCESS   ← the night before the rename

workflows/287019999      → state: "deleted"
workflows?per_page=100   → total_count 82 == 82 listed
  [.workflows[]|select(.path|test("agentic"))] → []      ← retired id is INVISIBLE here
```

⇒ 16 passes existed. Retention was never the limit; the runs were fully retained under an id you
cannot reach by enumerating `actions/workflows`.

## The two transferable rules

**1. A per-id population being COMPLETE does not make it the RIGHT population.**
`total_count == returned` proves the page is the whole population *for that id*. It says nothing about
whether the id spans the window you are claiming. Pair every bound test with: *does this id cover the
history I'm asserting over?* This is the dual of the "a non-zero control proves the endpoint responds,
not that the object is current" failure — same shape, opposite field: there a control was **valid and
irrelevant**, here a bound test was.

**2. A `≥N` floor can hedge in the wrong direction.** The issue argued `≥36` was deliberate because
the API "cannot distinguish 'workflow created then' from 'older history purged'." It can — via
`previous_filename`. The truth was not "possibly older" but **exactly 36 with a known start**, which
is strictly more actionable: it hands you a bisect boundary (last pass `28350804872` head
`3a84a12b8e` → first fail `28422435803` head `80bf926b57`, 15 commits). Hedging toward "possibly
worse, cannot tell" *reads* as caution while discarding the most useful fact on the table. A floor is
only conservative if the uncertainty axis is the one you think it is.

⛔ **Amendment — and it lands on this very number.** The recipient of the correction caught that the
36 is **not 36 failures**: one night (2026-07-28, run `30330588743`) is `cancelled`, i.e. **untested,
neither pass nor fail**. Unbroken *failure* segments are **28 + 7**. So *"36 consecutive nights
without a pass"* is true and *"36 consecutive failures"* is false.

⭐⭐⭐ **The instructive part is that I had already printed the histogram — `{cancelled: 1,
failure: 35}` is in the measurement above — and still wrote the streak as if it were uniform.
Possessing the disaggregated data is not the same as using it.** A `cancelled` run is evidence in
neither direction; folding it into a streak inflates the single strongest number in the report, which
is exactly where a reviewer checks first. **Segment by conclusion before quoting any streak, and say
which segments the run of `null`/`cancelled`/`skipped` breaks.**

⭐⭐ **Companion off-by-one from the same exchange: a DATE-ONLY boundary silently includes pre-event
rows when the event has a TIME.** I reported "26 failures after the 07-09 reconciliation" by filtering
`created_at > "2026-07-09"`; the fix merged at `09:03:26Z` and that night's run (`28996071406`) started
`05:22:16Z`, **before** it. Correct figure is 25 failure / 1 cancelled / 0 success. Compare against the
full timestamp — a same-day run sits on the wrong side of a mid-day merge.

⚠️ **Attribution correction on that one: the defect was in MY intermediate, not in the published
issue.** The author had filtered on a full timestamp from the start, so the artifact always read 25+1;
I inferred from a matching-shaped number that they had made my mistake. ⭐⭐⭐ **Reproducing a
figure someone else published does not tell you which query produced it — when your own recomputation
lands one off theirs, the first hypothesis to test is that YOUR filter differs, not that their number
is wrong.** The lesson about date-only boundaries stands on its own; the accusation attached to it did
not, and their artifact escaping it was incidental rather than guarded-against.

⭐⭐ **Third defect in the same family, caught by the recipient: the headline ratio mixed two
metrics.** "36 consecutive nights ≈ 4.5× the worst prior streak (8)" compares a **no-success** count
(36, which includes the cancelled night) against a **consecutive-failure** streak (8). That is only
apples-to-apples if the predecessor had no cancelled runs — measured, it has none
(`{success: 16, failure: 17}`), and its longest no-success and longest failure runs are **both 8**, so
the ratio holds under either definition. **Sound by measurement, not by construction.** ⭐⭐ **State
the precondition whenever you publish a ratio of two streak-like numbers, or a reader reusing the
shape on a suite that does have cancelled/skipped runs will silently mix the metrics.**

## Recipe — before any "never passed / N consecutive / streak / age" claim about a workflow

1. `gh api repos/<r>/actions/workflows/<id>` → note `created_at` **and `state`**.
2. `gh api "repos/<r>/commits?path=<workflow path>"` → if the oldest commit is a rename, or
   `created_at` is within seconds of it, **the id is younger than the suite**.
3. `gh api repos/<r>/commits/<sha> --jq '.files[]|select(.filename|test("<name>"))|.previous_filename'`
   → recover the historical path. Repeat transitively; renames chain.
4. Query **by filename** per historical path: `workflows/<old-name>.yml/runs`. Confirm with
   `[.workflow_runs[].workflow_id]|unique`.
5. Aggregate across ids. Use `runs?status=success --jq .total_count` per id as a direct zero/non-zero
   control instead of eyeballing a histogram.

⛔ **Never enumerate ids from `actions/workflows` for a historical question.** A retired id **may be**
absent from that listing while remaining fetchable directly with its runs intact — and a dormant id
**may be** present while its job's history has moved to another workflow. Neither presence nor absence
in the listing tells you where a suite's history lives; only `previous_filename` does.

## Two collateral corrections worth generalizing

- **A cosmetic rename is the obvious suspect for a pass→fail boundary and was NOT the cause here.**
  Measured: the rename's entire patch to the workflow was `name:` plus one comment line. Check the
  patch before blaming the rename — and equally, don't overcorrect into "it was green before the
  rename": the predecessor flapped **16 pass / 17 fail** with an 8-night fail streak of its own. The
  honest framing was neither "never passed" nor "was green" but *"always flapped, then stopped
  flapping into green at all."* Both tidy framings were wrong.
  ⚠️ **Caveat on that 16/17, added on re-derivation: it is an ALL-EVENTS count, and the 36 it gets
  compared against is SCHEDULE-ONLY.** The predecessor's 33 runs are 28 `schedule` + 5
  `workflow_dispatch` (two June days carry 3–4 runs *total* — 06-02 is 1 scheduled + 2 dispatched,
  06-04 is 1 + 3; I first misrecorded those totals as the dispatch counts themselves, and the error
  survived because the composite 5 was right — ⭐⭐ **when you split a total by class, print every
  class AND the total; a sum check cannot catch a misattributed split**); schedule-only it is
  **14 pass / 14 fail**. The
  successor id is 36 `schedule`, 36 distinct nights, one run per night. The qualitative conclusion
  ("always flapped") holds under both slicings, but ⭐⭐ **when you compare two populations across a
  rename, check `event` on both before quoting counts — "runs" and "nights" diverge exactly where
  manual dispatches cluster, and a per-night claim built from an all-events count is a different
  metric wearing the same units.**
  ⛔⭐⭐⭐ **And the check that makes "N nights" mean nights: `len(set(dates)) == len(rows)`, printed,
  not assumed.** Measured here: predecessor schedule-only 28 runs → 28 distinct dates; successor
  36 → 36; zero doubled days either side. The corrective edit that fixed this very units conflation
  **restated the units from a row count without running that check** — it was true by luck, and a
  third party had to verify it. ⭐⭐⭐ **Fixing a units bug is the highest-risk place to restate the
  units: the corrected sentence reads as the careful version, so it draws LESS scrutiny than the
  original did.** Same family as the diligence slot — the text written to demonstrate care is audited
  least.
- **A line count is not an entry count.** The issue cited `_meta/expected-failures.txt` as
  "195 lines" to argue appending wouldn't clear the gate. It is 155 comment lines + 16 blank +
  **24 entries** — an ~8× overstatement of the suppression set. `grep -vc '^\s*#\|^\s*$'`.
