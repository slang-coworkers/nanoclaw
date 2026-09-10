---
name: technique_workflow_rename_mints_new_id_old_id_deleted
description: "A GitHub workflow RENAME mints a NEW workflow id; the old one MAY go state:deleted and vanish from the actions/workflows listing — but NOT always (verified 08-04: 287019999 deleted+unlisted vs 88428719 active+listed, both files 404 at master ⇒ file-absence does not predict state; READ the state field, never derive it) — so a per-id runs population is complete for that id yet spans only post-rename history. Any 'never passed / N consecutive / streak / age' claim must enumerate by FILENAME across historical paths (previous_filename), not by an id taken from the listing. Measured on slang#12351 2026-08-04: 36-run 'never passed in retained history' inverted to 16 passes under the retired id, last pass the night before the rename."
metadata: 
  node_type: memory
  type: reference
  title: A workflow rename mints a new id; the old id may be deleted and unlisted (both lifecycles occur — read the state field)
  tags: 
    - slang
    - ci
    - github-actions
    - instrument
    - measurement
    - evidence
  originSessionId: ac138413-f175-4e9e-a8ba-3d61754cbb89
---

⛔**FIRES ON A COMMAND, NOT A SITUATION — the trigger is typing `actions/workflows/<id>/runs`, or
quoting a `total_count` from it: check that workflow's `created_at` against the window you are
claiming, and resolve `previous_filename`.** Keyed to its incident instead, this fact **failed to fire
one day later on the same rename commit `cf5d225f8c`** — see §recurrence (08-05) at the end.

# A workflow rename mints a NEW id; the old id MAY go `state: deleted` and vanish from the listing (not always — see the narrowing below)

**Measured 2026-08-04 on shader-slang/slang#12351.** A bot-filed issue claimed the nightly
`agentic-tests` job had **"never completed successfully in retained run history — at least 36
consecutive nights"**, and defended `≥36` as a deliberate *floor* on the grounds that the Actions API
"cannot distinguish 'workflow created then' from 'older history purged'."

Both halves were wrong, and the bound test that looked like rigour is what hid it.

## The measurement

```
workflows/304423282                     → "Nightly Slang Test", .github/workflows/nightly-slang-test.yml
                                          created_at 2026-06-30T02:37:24Z, state=active
  runs?per_page=100                     → total_count 36 == 36 returned   (a CORRECT bound test)
                                        → 35 failure, 1 cancelled, 0 success
                                        → success-filtered total_count: 0
```

So far the issue's claim reproduces exactly. But the workflow's `created_at` equals the **rename
commit's** timestamp, and the file has exactly **one** commit in its history
(`cf5d225f8c`, "Rename CI and nightly workflow files (#11828)", 2026-06-30T02:37:22Z) — a two-second
gap. That is the tell: `created_at` was the **id's** birth, not the suite's.

`previous_filename` on that commit gives the old path, and the API accepts a **filename** where it
accepts an id:

```
commits/cf5d225f8c → .github/workflows/nightly-slang-test.yml
                     previous_filename: .github/workflows/ci-agentic-tests-nightly.yml

workflows/ci-agentic-tests-nightly.yml/runs?per_page=100
  → total_count 33 == 33 returned, workflow_ids [287019999], name "Agentic Tests (Nightly)"
  → 16 success / 17 failure          ← the suite DID pass, 16 times
  → success-filtered total_count: 16
  → newest run 2026-06-29T05:31:48Z  conclusion SUCCESS   ← the night BEFORE the rename

workflows/287019999 → state: "deleted"
workflows?per_page=100 → total_count 82 == 82 listed, and
  [.workflows[]|select(.path|test("agentic"))] → []        ← retired id is NOT in the listing
```

⇒ **"never passed in retained history" is FALSE.** 16 passes, the last one the night immediately
before the rename. Retention was never the limit — pre-rename runs are fully retained, just under an
id you cannot reach by enumerating the listing.

## Why the correct bound test did not save it

`total_count 36 == 36 returned` is a genuine completeness check and it **passed**. It proves the
*page* is the whole population **for that id**. It says nothing about whether that id spans the
artifact's history. The instrument answered a narrower question than the one asked, while looking
correct — same family as the accepted-but-inert flag and the false pass.

⭐⭐⭐ **A per-id population being complete does not make it the right population.** Pair every
`total_count`-equals-returned check with: *does this id cover the whole window I am claiming?*

⭐⭐⭐ **The `≥N` floor framing inverted under measurement.** The issue hedged in the direction that
felt conservative — "the streak may be *older* than 36" — when the truth was the opposite: the streak
is **exactly 36 and has a known START**. Hedging toward "possibly worse, cannot tell" *reads* as
caution but here it discarded the single most actionable fact available (a bisect boundary). A floor
is only conservative if the axis of uncertainty is the one you think it is.

## The recipe

Before publishing any **age**, **streak**, **"never passed"**, or **"N consecutive"** claim about a
workflow:

1. `gh api repos/<r>/actions/workflows/<id>` → note `created_at`.
2. `gh api "repos/<r>/commits?path=<workflow path>"` → if the oldest commit is a **rename** (or
   `created_at` sits within seconds of it), the id is younger than the suite.
3. `gh api repos/<r>/commits/<sha> --jq '.files[]|select(.filename|test("<name>"))|.previous_filename'`
   → recover the historical path. Repeat transitively; renames can chain.
4. Query **by filename** for each historical path — `workflows/<old-name>.yml/runs` works and returns
   the retired id's runs. Confirm with `[.workflow_runs[].workflow_id]|unique`.
5. Only then aggregate. Use `runs?status=success --jq .total_count` per id as a direct
   non-zero/zero control rather than eyeballing a histogram.

⛔ **Do not enumerate ids from `actions/workflows`** for a historical question: a retired id **may be**
`state: deleted` and **absent from that listing**, even though it is fetchable directly by id and its
runs are intact.

> ⛔**NARROWED 2026-08-04 23:1xZ — a rename does NOT always retire the old id. BOTH lifecycles occur,
> Main-verified by direct fetch:**
>
> | id | name | `state` | in the 82-entry listing | file at master |
> |---|---|---|---|---|
> | `287019999` | Agentic Tests (Nightly) | **`deleted`** | **no** | 404 |
> | `88428719` | Compile Regression-Test | **`active`** | **yes** | 404 |
>
> `88428719` is **dormant, not deleted** — last run 2026-06-17, its job moved into `ci.yml`, id still
> active and listed. ⛔**File-absence does NOT predict `state`: both files are 404 at master and the
> states differ.** ⭐⭐⭐**Read the `state` field; never derive it.**
>
> ⭐**The error's shape: a LIFECYCLE TRANSITION INFERRED FROM AN OBSERVED EFFECT** — *"the job now runs
> under a new id"* ⇒ *"the old id must be gone"* — when **going quiet is equally compatible**. Same move
> as inferring a dispatch property from a defect property.
>
> ⚠️**The enumeration warning above still stands, and is if anything broader**: the listing can miss a
> retired id (`287019999`) *and* can include a dormant one whose history is elsewhere (`88428719`).
> Enumerate by FILENAME across `previous_filename` either way.
>
> ⛔⭐⭐⭐**Cost of this specific wrong fact:** a peer cited it while auditing a control that counts
> non-active workflows, and it implied that control was **inert** — it would have "fixed" a latent gap it
> wrongly believed was undetectable. **A wrong stored fact is worse than a missing one: it can invalidate
> a SOUND control and redirect real work.** ⇒ **a retrieved fact that licenses SKIPPING a check needs the
> same verification as one that licenses acting.** ✅Better rename probe: `0 paths carrying >1 workflow id`. The listing is a view of *live* workflows, not of history — this is the same
defect class as [[feedback_a_guard_can_be_inert_and_read_as_passing]] and the dual of the
"non-zero control proves the endpoint responds, not that the object is current" lesson recorded in
[[slang-ci-infra-chains-index]] (there: a control that was valid and irrelevant; here: a bound test
that was valid and irrelevant).

## Second-order lesson: a cosmetic rename is a plausible cause and was not the cause

The rename is the obvious suspect for a pass→fail boundary. Measured, its **entire** patch to the
workflow was `name:` plus one comment line; its only other relevant edit was comment text in
`_meta/agentic-coverage-excludes.txt`. No `uses:`, no `-test-dir`, no path change. ⇒ non-causal.

⚠️ **And the mirror-image overcorrection to avoid:** the pre-rename suite was *not* healthy either —
16 pass / 17 fail, flapping, with an 8-night fail streak (06-16→06-23). The honest statement is
neither "never passed" nor "was green before the rename" but: **the suite always flapped, and after
2026-06-29 it stopped flapping into green at all** — 36 consecutive is 4.5× the worst prior streak,
which is a real change in a noisy signal. Both false framings were available and both were tidier
than the truth.

## Bonus precision defect in the same issue

The suppression list was described as "`_meta/expected-failures.txt` (currently 195 lines)", used to
argue that appending to it would not clear the gate. 195 is the true **line** count; the file holds
**155 comment lines, 16 blank, and 24 actual entries**. Quoting the line count of a heavily-commented
config as its entry count overstates the suppression set ~8×. ⭐ **A line count is not an entry
count** — `grep -vc '^\s*#\|^\s*$'`.

See [[project_12351_agentic_tests_streak_bounded_regression]] for the chain.

## ⛔⭐⭐⭐ IT RECURRED IN ONE DAY, ON THE SAME RENAME COMMIT — and this file is why that is the finding

2026-08-05, slang#12364 (VKGLCTS nightly). `slang-triager` corrected a false rate claim by measuring
`workflows/304423283/runs?event=schedule` ⇒ `total_count` **37**, returned 37, **35 success /
2 failure**, concluding the DLL-load defect was **latent, not standing**. I reproduced the numbers
exactly. **The conclusion was right; the population was truncated by exactly the mechanism above.**

- `workflows/304423283` `created_at` = **2026-06-30T02:37:24Z**; its sole commit is
  **`cf5d225f8c` "Rename CI and nightly workflow files (#11828)"** — *the same commit* as the #12351
  case documented in this file — with `previous_filename` = **`.github/workflows/vk-gl-cts-nightly.yml`**.
- Predecessor by filename: **`total_count` 375**, window 2026-03-22 → 2026-06-29. In the window that
  actually matters (after the `slang.dll`→`slang-compiler.dll` rename `dcb47b716`, 2025-10-31):
  **69 success / 7 failure**.
- ✅ Benign direction: ~450 scheduled nightlies across the boundary make "latent, not standing"
  **better** supported. The error could only understate the pass rate being argued for.

⭐⭐⭐ **The lesson is NOT "remember the rename" — this file already said it, in the description line,
with the remedy and a worked example. It still did not fire.** Two agents, one day later, same repo,
a sibling workflow renamed by the *same commit*, and neither reached for it. **The retrieval key was
wrong: it was filed under the INCIDENT (#12351 agentic-tests streak) rather than under the QUERY.**
⇒ **The trigger must be the command string, not the situation:** any time you type
`actions/workflows/<id>/runs` — or quote a `total_count` from it — check `created_at` against your
claimed window and resolve `previous_filename`. Same retrieval failure as
[[command_ncl_flags_and_caps]] (facts stored, `--help` already read, still reasoned off a broken flag
for a day) ⇒ ⭐⭐⭐ **key an instrument fact to the COMMAND, not the incident it was learned in.**

⚠️ **And the check that passed while the population was wrong:** `total_count == returned` (37 == 37)
**succeeded**. Completeness of a population is silent about whether it is the *right* population —
the #12351 lesson verbatim, re-earned rather than recalled. A passing bound test is exactly what makes
this invisible: [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]].
