---
type: feedback
name: feedback_name_what_your_instrument_cannot_record_before_enumerating
description: "The only verification check that runs BEFORE you have a result: name what your data source structurally cannot record, then enumerate rivals INCLUDING those. Every other control needs something first (a domain prior, a hypothesis, a fetched item). Worked case: VKGLCTS, where tree comparisons could not see an unpinned external fetch. Family entry point: the sibling rules 'elimination is not sufficiency' and 'a null at huge n can be a false null' were split out 2026-10-17."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04
---

**Derived with `slang-ci-babysitter`, 2026-08-04, during the VKGLCTS cause hunt on slang#12341.**

## The rule

**Before you list candidate causes, name what your data source structurally cannot record. Then list rivals,
and include those.** You can derive the blind spot from what the tool is, so you can name it before any data
arrives. That is the only moment when nothing has gone wrong yet.

| check | needs first |
|---|---|
| implausibility | a domain prior strong enough to be surprised |
| a designed control | a hypothesis to test |
| the residual/unmatched bucket | the item to have been *fetched* at all |
| **this one** | **only knowledge of what the instrument IS** |

Every other control compares one measurement to another, so a blind spot that both share defeats both.

## Instrument → blind spot

| instrument | structurally cannot record |
|---|---|
| a tree/commit comparison | anything fetched from **outside the repo** (`latest: true` downloads, container tags) |
| `actions/runs` + `attempts/N/jobs` | a runner's **local state** (installed toolchains, drivers, disk) |
| `commits/{sha}/check-runs` | **commit statuses** (a separate API, incl. cross-repo, e.g. `SlangPy Tests`) |
| a **per-id** workflow-runs query | history that moved to **another workflow id** ([[technique_workflow_rename_mints_new_id_old_id_deleted]]) |
| a PR-head-scoped sweep | the **merge-group commit**, where queue gates fail ([[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]]) |
| `issues/{n}/comments` | **review** comments and **reviews** (three separate surfaces) |
| any single-page fetch | everything past the page cap |

## Worked case — the rival no instrument could see

`Nightly Slang VKGLCTS Test` broke on 08-04 after 35 green nights. Tree comparisons, runner enumerations,
and attempt walks eliminated the pool-lottery draw (36/36 on SLANGWIN5) and a transient (two attempts on
one sha, both failed). Then the babysitter grepped the workflow file and found an **unpinned** fetch
(`robinraju/release-downloader` with `latest: true` on `shader-slang/VK-GL-CTS`). That was a fourth rival:
the harness could change with no commit in slang, and no tree comparison could see it. It was
eliminable (the asset was 6 months old), but that was luck about the answer, not about the method.
**All four instruments were correct, and none of them could have surfaced it.**

## The sequence

1. **Name what the instrument cannot see**, from the tool's nature, not from its output.
2. **List rivals, and include those.**
3. **Name a discriminator per rival:** a check whose result changes with which rival is true.
4. ⛔ **Do not rank untested rivals.** A build-config mechanism we both liked was not in the job's execution
   path, and one `grep uses:` refuted it. A plausible mechanism with an untested consumption path is not
   evidence.
5. **Eliminate rivals one at a time, and remember that convergence needs a complete list.** If you never
   listed a fifth rival, eliminating three of four still leaves the answer open. A survivor is not
   confirmed: see [[feedback_elimination_is_not_sufficiency]].

The same family covers a probe aimed at the right artifact through a window the phenomenon cannot cross:
[[feedback_a_null_at_huge_n_can_be_a_false_null]]. **Keep one entry point per family.** Extend the nearest
note and cross-link it. If each rule is filed as a fresh note, the rules cannot find each other.

## Why it matters beyond being wrong

**A refutable detail inside a correct report costs the correct part its credibility.** In one evening there
were three cases: a "0.0.8 already exists, so this is about to break" claim (but 0.0.8 is `prerelease=true`,
which is *why* `latest` resolves to 0.0.7), a mechanism for a job that never invokes those files, and a
"36/36 on one box" headline. **An invariant correlates with everything, so it cannot discriminate.**

The operational result: VKGLCTS is label-pinned (`runs-on: [..., vulkancts]`), so it can never produce an
other-runner control. Filing it under #12341 would have brought an unclosable question into an
escalation whose own control was clean. **We unfiled it.**

Related: [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[feedback_control_the_instrument_not_the_reasoning]] · [[feedback_a_discriminator_is_a_claim_about_a_log_run_it]]
