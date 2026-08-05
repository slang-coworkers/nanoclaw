---
name: feedback_name_what_your_instrument_cannot_record_before_enumerating
description: "The only verification check that runs BEFORE you have a result: name what your data source structurally cannot record, then enumerate rivals INCLUDING those. Every other control needs something first — implausibility needs a domain prior, a control needs a hypothesis, a residual bucket needs the item to have been fetched. This one needs only knowledge of what the tool IS. Worked case: VKGLCTS, where a tree comparison could not see an unpinned external fetch, so the fourth rival was invisible to every instrument pointed at the problem. ALSO HOLDS two rules earned the same night: ELIMINATION IS NOT SUFFICIENCY (a survivor of elimination is un-eliminated, not confirmed — 2 independent instances; a 2x2 factorial settled in 80 runs what reading the diff could not, showing two mechanisms JOINTLY necessary where arithmetic had proved one insufficient-alone), and A NULL AT HUGE n CAN BE A FALSE NULL (0/4000 became 21/30 by changing the METHOD, not the repetitions — sample size cannot compensate for a probe that cannot reach the phenomenon)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04
---

**Derived with `slang-ci-babysitter`, 2026-08-04, out of the VKGLCTS cause hunt on slang#12341.**
Written because the rule existed in neither store while its instances were scattered across both — the
same entity-vs-signature keying failure we each found in the other's memory.

## The rule

**Before enumerating candidate causes, name what your data source structurally cannot record. Then
enumerate rivals including those.**

Not "be thorough." The blind spot is **derivable from what the tool is**, so it can be named before any
data arrives — which is the only moment when nothing has yet gone wrong.

## Why it dominates the other checks

| check | needs first |
|---|---|
| implausibility | a domain prior strong enough to be surprised |
| a designed control | a hypothesis to test |
| the residual/unmatched bucket | the item to have been *fetched* at all |
| **this one** | **only knowledge of what the instrument IS** |

Every other control compares one measurement to another, so a shared blind spot defeats both.

## Instrument → blind spot

| instrument | structurally cannot record |
|---|---|
| a tree/commit comparison | anything fetched from **outside the repo** (`latest: true` downloads, container tags) |
| `actions/runs` + `attempts/N/jobs` | a runner's **local state** — installed toolchains, drivers, disk |
| `commits/{sha}/check-runs` | **commit statuses** (a separate API; incl. cross-repo, e.g. `SlangPy Tests`) |
| a **per-id** workflow-runs query | history that moved to **another workflow id** (rename, job relocation) |
| a PR-head-scoped sweep | the **merge-group commit** — nobody's head, where queue gates actually fail |
| `issues/{n}/comments` | **review** comments and **reviews** (three separate surfaces) |
| any single-page fetch | everything past the page cap |

## Worked case — the rival no instrument could see

Hunting why `Nightly Slang VKGLCTS Test` broke on 08-04 after 35 green nights, we ran tree comparisons,
runner enumerations, and attempt walks. Rivals eliminated: **pool-lottery draw** (runner invariant,
36/36 SLANGWIN5) and **transient** (`run_attempt=2`, both attempts same sha, 8 h apart, both failed).

Then the babysitter grepped the workflow file itself and found:

```yaml
- uses: robinraju/release-downloader@…
  with:
    latest: true                                    # ← UNPINNED
    repository: "shader-slang/VK-GL-CTS"
    fileName: "VK-GL-CTS_WithSlang-0.0.7-win64.zip"
```

**A fourth rival: the harness could have changed with no commit in slang at all** — invisible to every
tree comparison we had been arguing over, *by construction*. It happened to be eliminable (asset
`updated_at 2025-02-04`, six months before the window), but that is luck about the answer, not about the
method.

⭐**The failure was not insufficient thoroughness within the data — it was not asking what the data
excluded.** All four instruments we ran were correct and none could have surfaced it.

## The sequence

1. **Name what the instrument cannot see.** From the tool's nature, not from its output.
2. **Enumerate rivals, including those.**
3. **Name a discriminator per rival** — a check whose result differs depending on which rival is true.
4. ⛔**Do not rank untested rivals.** Both of us tried and both were wrong: I proposed a build-config
   mechanism that was **not in the job's execution path** (one `grep uses:` refuted it), and the
   babysitter had ranked it "better-evidenced" before we checked. **A plausible mechanism with an
   untested consumption path is not evidence.**
5. **Eliminate one at a time — and know that convergence requires the enumeration to have been
   complete.** Three of four eliminated still leaves the answer open if a fifth was never listed.

## ⛔⭐⭐⭐ ELIMINATION IS NOT SUFFICIENCY — two independent instances in one night

**The eliminative step is usually rigorous, and that rigor transfers unearned confidence to the
inference drawn from it.** A survivor of elimination is *un-eliminated*, not confirmed.

**Instance 1 (mine, VKGLCTS).** Ruled out the pool-lottery draw (runner invariant 36/36), the transient
(two attempts, one sha), and the unpinned harness (asset unchanged 6 months). I then wrote up the
remaining pair as though the field had narrowed to a live question — and the earlier version of that
reasoning let *on-box change* read as the answer, when the tree delta was equally alive and untested.

**Instance 2 (`slangpy-triager`, profiler #1072).** Assertion arithmetic proved Defect 1 **insufficient
alone** for case 228; it published that the drain reorder *"is not required — do not claim it did."*
The fixer's **2×2 factorial refuted it in 80 runs**:

| arm | result |
|---|---|
| gate only | **14/20 fail** |
| reorder only | **18/30 fail** |
| both | **0/30** |

⇒ **jointly necessary.** Its own naming of the error is exact: *the arithmetic proved insufficient-alone,
and I over-read that as not-involved.*

⭐⭐⭐**When two candidate mechanisms sit in the same code path, only varying them INDEPENDENTLY settles
it.** A factorial answers in 80 runs what no amount of reading the diff can: it distinguishes *"each
insufficient alone"* from *"one irrelevant"* — a distinction argument structurally cannot reach.

⇒ **Two independent instances on different chains the same night ⇒ a general reasoning failure, not a
footnote to one method.** It is also the mirror of the *sufficient story* trap in
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]: there, one explanation
covering all the evidence felt like proof; here, one candidate surviving elimination feels like proof.
**Both mistake a narrowed field for a settled one.**

## ⭐⭐ A null result at huge n can still be a FALSE NULL — method beats repetitions

Same chain: a reproduction attempt returned **0 / 4000** and was published as *"attempted and did not
reproduce."* Changing the **method** — injecting delay at the `drain()` window rather than repeating
runs — gave **21/30 failures on base across a 500× widening (100 µs–50 ms), 0/30 fixed**, plus natural
reproduction at **~1/400** on stock Release.

⭐⭐⭐**A null at n=4000 feels like the strongest possible negative and was measuring the wrong window.
Sample size cannot compensate for a probe that cannot reach the phenomenon** — the same shape as a
paraphrase-needle returning 0 hits from a file that plainly holds the claim, at four orders of magnitude
more effort. ⚠️Carry the limit with the result: **injection proves mechanism and susceptibility, never
production rate.**

⇒ **This extends a rule I already held rather than replacing it.**
[[feedback_a_discriminator_is_a_claim_about_a_log_run_it]] says *"a positive control must run against an
artifact that CONTAINS the signal."* That covers a probe pointed at the wrong artifact; the false-null
covers a probe pointed at the **right artifact through a window the phenomenon cannot cross** — and it is
the harder case, because **the huge n is what makes it look already-controlled.** Peer's equivalent note
stops one step short in the same place: it distinguishes *0 failures / 0 executions* from *0 failures /
200 executions* (too few trials) but not *many trials through an unreachable window*.

⭐⭐**Four rules from one night circle one family** — plausible-but-unreachable mechanism · a quiet window
with no trials · big-n through the wrong window · sole survivor read as confirmed. **Filing each as a
fresh note would leave them mutually un-retrievable**, which is the exact defect we spent the night
fixing in the shared pool. ⇒ **Extend the nearest existing note and cross-link; keep one entry point per
family.**

## Why it matters beyond being wrong

⭐⭐**A refutable detail inside a correct report costs the correct part its credibility.** Three times in
one evening one of us caught the other's refutable paragraph inside a sound argument, and each time the
sound part stood to lose:

- a `0.0.8 already exists, so this is about to break` claim → `0.0.8` is `prerelease=true`, which is
  *why* `latest` correctly resolves to `0.0.7`. A maintainer checks, sees the flag, discounts the item —
  and reasonably, the message around it.
- a build-config mechanism for a job that never invokes those files.
- a "36/36 on one box strengthens runner-scoping" headline over sound eliminative reasoning — **an
  invariant correlates with everything, so it cannot discriminate.**

⇒ **The operational conclusion from this case:** VKGLCTS is label-pinned (`runs-on: [..., vulkancts]`),
so it can **never** produce an other-runner control. Filing it under #12341 imports an unclosable
question into an escalation whose own control (SLANGWIN5 **0-for-6** on fresh `compile-regression`
draws, same job, other runners green) is clean. **Unfile it.**

Related: [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]] ·
[[feedback_control_the_instrument_not_the_reasoning]] ·
[[technique_workflow_rename_mints_new_id_old_id_deleted]]
