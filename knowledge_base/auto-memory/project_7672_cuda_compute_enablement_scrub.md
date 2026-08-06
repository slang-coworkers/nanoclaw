---
name: project_7672_cuda_compute_enablement_scrub
description: "slang#7672 'Explore compute subdir' — departure scrub ANSWERED 08-05 (verdict cmt 5197243220, sibling correction 5197417526). Verdict: rescope + reassign, don't close. RESUME=jkiviluoto-nv picks an owner. Holds the TEST_DISABLED-is-inert finding and the #7591/#7723 successor-programme lineage I verified myself."
metadata: 
  node_type: memory
  type: project
  originSessionId: e81fc814-70ee-4ef5-878f-5223e6c66a78
---

# slang#7672 — "Explore compute subdir" (CUDA test enablement work order)

**State (08-05):** scrub answered, **nothing mutated** (no label/assignee/milestone/state change).
Verdict comment `5197243220` (triager), plus a sibling second pass `5197417526` at 21:12:58Z that
corrected two numbers in the first. **RESUME = `jkiviluoto-nv` picks an owner / rescopes**, or closes
as superseded (see lineage below — that case is now stronger than the posted verdict says).

Assignee `mkeshavaNV` (departing). Filed 2025-07-09 by him. Milestone `Q3 2025 (Summer)` — closed.
It is a **work order, not a bug**: "categorize every test under `tests/compute` and enable CUDA."
Dispatched once to `@claude` 2025-07-16, died on tooling at **2 of 7** checklist boxes.

## ⭐⭐⭐ `TEST_DISABLED` IS NOT A DIRECTIVE — verified at source on my own edge

`tools/slang-test/slang-test-main.cpp`: `disablePrefix = UnownedStringSlice::fromLiteral("DISABLE_")`
(**:670**), stripped only via `command.startsWith(disablePrefix)` (**:675-679**). Any unrecognized
command falls through to **:781-786** — *"Hmm we don't know what kind of test this actually is. Assume
that's ok and this **isn't** a test and ignore."* — `skipToEndOfLine`, **silently**.

⇒ `//DISABLE_TEST` = recognized-and-disabled. `//TEST_DISABLED`, `//DISABLED_TEST`, `//IGNORE_TEST`
= **inert text**. Measured under `tests/compute` (mine, reproduced):

| spelling | status | lines | files |
|---|---|---|---|
| `//DISABLE_TEST` | real | **79** | **34** |
| `//TEST_DISABLED` | inert | 6 | — |
| `//DISABLED_TEST` | inert | 33 | — |
| `//IGNORE_TEST` | inert | 1 | — |
| `//DISABLED_TEST` tree-wide | inert | — | **48** `.slang` files |

⛔ **The issue's own premise inherits the bug.** #7672's body defines category 2 as *"cuda present but
explicitly disabled via `TEST_DISABLED`"* — **a spelling the harness does not recognize.** The task
asks someone to "enable and run" a category defined by inert text. ⇒ Rescope is not just tidying, it's
a correctness fix to the ask. ⚠️ **Wider latent hazard: the harness never warns**, so an inert line is
indistinguishable from a typo that silently dropped a test somebody meant to run — 48 files tree-wide.

## The overlap that broke the published census

`tests/compute/pack-any-value-16bit.slang` carries an inert `//TEST_DISABLED(compute):…-cuda` at
**:3** *and* an active `//TEST(compute):…-cuda` at **:6** (verified). So it counted in both cat1 (82)
and cat2 (7) ⇒ the three categories summed to **215** against a printed total of **217**.

⭐⭐ **Two rules from this, narrower and more useful than "summaries go stale":**
- **A category scheme needs its disjointness TESTED, not assumed — sum the parts against the whole.**
  The discrepancy was visible on the same line as the total and never added up.
- ⭐⭐⭐ **A per-file grep cannot measure a per-line property.** `grep -l` answers *"does this file
  contain X"*, which silently becomes *"this file **is** X"* the moment it lands in a category table.
  One file holds many directive lines, so "files with an active `-cuda`" and "files with a disabled
  `-cuda`" are **not disjoint**.

## Successor programme — I verified this myself; the sibling's numbers do NOT all reproduce

The triager's *"no successor issue"* was **true by omission**: they searched for prior art on the
tests and never searched for a successor *tracker*. There is one, and it is a whole programme:

- **#7591 "Enable more tests for CUDA"** (mkeshavaNV, **CLOSED** 2025-08-06) — the real parent. Body
  carries the same 3-category scheme **as prose** and a 49-directory checklist with **`hlsl` and
  `hlsl-intrinsic` ticked, `compute` NOT ticked** (`:18`).
  ⛔ **CORRECTION to my own wording — I wrote "identical scheme", and the difference is the whole
  point.** #7591 says only *"2. Test has cuda **disabled explicitly**"* — **prose, no directive name
  anywhere.** #7672 renders that same category as *"explicitly disabled via `TEST_DISABLED`"*. ⇒ **The
  inert spelling was NOT inherited from the parent tracker; #7672 INTRODUCED it when translating a
  correct prose category into a concrete directive name.** So a corrected re-file wants #7591's prose
  definition **plus** the real `//DISABLE_TEST`. ⭐⭐ *"Identical" collapsed the one distinction that
  locates the defect* — the concept was identical, the spelling was not, and the spelling is what the
  harness reads.
  ⚠️ The peer's own grep first reported this claim **false at 0 hits**, because it searched
  `TEST_DISABLED|category` — #7591 writes *"3 **categories**"* in plural prose and never uses the
  directive spelling at all. ⭐⭐⭐ **They encoded #7672's VOCABULARY instead of the CONCEPT, so the
  pattern could not see the same scheme expressed in different words — a false negative committed
  while auditing someone else's claim.** A cross-document "same scheme?" check must search the idea
  (`categor`, `cuda enabled`), never one document's term of art.
- **#7723 "cuda test enablement burndown tracker"** (mkeshavaNV, **CLOSED** 2025-09-19, assignee
  `szihs`) — 156 tests enumerated by path in `szihs`'s comment `3144311606`.
- **#8077 "Batch 1: Autodiff Tests (1-16)"** (**CLOSED** 2025-08-18) — **parent named as #7591, not
  #7723**, and **13 of 16 boxes ticked (~81%)**.

⛔ **Two numbers I could not reproduce, flagged rather than relayed:** the sibling reported the batches
as *"all closed at ~61% ticked"* and parented to **#7723**; #8077 reads **~81%** and names **#7591**.
⚠️ Also **#8077's own footer says "Progress: 0/16"** against 13 ticked boxes — so *the issue
contradicts itself*, and any percentage depends on which field you read. **Do not quote a completion
rate for this programme without naming the field it came from** (checkbox count vs footer text).
I checked #8077 only; #8078–#8086 unverified by me.

⭐⭐⭐ **THREE figures now in play for one programme — ~61%, 81%, "0/16" — disagreeing WITHIN A SINGLE
ISSUE. ⇒ A percentage here is not a measurement, it is a CHOICE OF FIELD.** And the peer added the
part that kills the metric outright: **#8083–#8086 carry reasoned skips**, so even the ticked ratio
**conflates "done" with "deliberately won't do."** ⇒ For any burndown/checklist artifact, report
`ticked / total / deliberately-skipped` as three separate numbers, or don't report a rate at all.
Sibling of the `conclusion==failure` census blind spot: the roll-up erases the distinction that matters.

⇒ **Consequence for the verdict:** #7672's work was **superseded by #7591 → #7723 → batch issues**,
all now closed, with `compute` still un-ticked at the directory level. That makes "close as superseded,
and re-file with a corrected category definition if the work is still wanted" a stronger option than
the posted comment conveys. Worth saying to `jkiviluoto-nv` if he asks.

## Prior-art dating trap (triager's, worth keeping)

They first inferred *"someone already did this work"* from `texture-get-dimensions-cuda.slang`
existing, then **dated it**: `549aa897b`, 2025-04-01 — **~3 months BEFORE the issue was filed.** So
it's prior art the author likely knew of, **not progress since**. Publishing it undated would have
implied the task had advanced when it hadn't.

Related: [[feedback_a_caveat_covering_the_confirming_step_is_the_finding]],
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] (this issue is where the
*additive* second-pass shape recurred), [[technique_verify_a_cited_path_exists_at_master_before_triaging]].
