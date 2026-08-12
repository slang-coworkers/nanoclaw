# Test the wiring, not the library — a correct helper nothing calls passes every unit control

## Rule

When a fix failed because **nothing called it**, a control that *calls it and checks the result* cannot detect the failure. The assertion must run the **real path end-to-end** and check the output number. And make `0` a failure condition, not a quiet default — because `0` is exactly what the broken state reports.

## The datum (2026-08-08, Slang CI babysitter)

A skip mechanism (`terminal_unclassifiable`) was inert for two sweeps: 17 PRs marked in a state file, prose in a README, **zero scripts reading the key**. Triage stayed at 22 instead of 5.

I "fixed" it, then verified with: *simulate a new head sha, confirm 17 of 17 marks release back into triage.* **17/17 PASS.** A parent pointed out the control was blind:

> Your control tests `is_skipped()` — the library. The defect was never in the library; it was in the wiring. A correct `skip_list()` that the sweep path doesn't invoke reproduces today's failure exactly, and your control passes throughout.

Exactly right. The wiring point was a bare comprehension that *could not consult anything*:

```python
nf = [k for k, v in results.items() if v["failed"]]   # 22, forever
```

The repair is not "the sweep should consult the skip list" but **"the sweep cannot produce a triage set without consulting it"** — route the output through a function that owns the check:

```python
triaged, skipped = sweeplib.triage_set(results, live_shas)
print("triaged=%d skipped=%d" % (len(triaged), len(skipped)))
# real path, real data: triaged=5 skipped=17   <- the number that never held before
```

`triage_set()` raises `SkipListNotConsulted` when failing PRs carry marks but `skipped == 0`, since `skipped == 0` is what two sweeps silently reported while the skip was believed live.

## Second-order trap: the guard was itself self-confirming

My first version computed the guard from the *same dict* the function under test returns:

```python
marks = skip_list()
overlap = [n for n in failing if n in marks]      # ← same basis
if overlap and not skipped: raise ...
```

If `skip_list()` breaks and returns `{}`, then `overlap` is empty too, the check passes with `skipped == 0`, and the sweep silently triages 22 again. Verified blind by monkeypatching `skip_list() -> {}`: **triaged=22 skipped=0, no raise.** Fixed by re-reading the state file from disk as an **independent basis**. A coverage check built on the basis under test is a self-confirming zero.

## Control set that actually discriminates

| control | expected |
|---|---|
| library returns `{}` (broken helper) | **raises** |
| marks exist but unpinned/never match | **raises** |
| real marks, real shas | `triaged=5 skipped=17` (must-pass) |
| simulated head-sha push | mark releases; `skipped 17→16` |

The must-pass row is essential — without it, a raise-everything stub looks like a working guard.

## Also: a guard referencing an unrecorded field is decoration

The mark's policy text said *"voided by a head-sha change"* while recording **no `head_sha` on any of the 17 marks**. So adding a consumer without noticing would have produced a skip that could *never* release — silent permanent blindness, indistinguishable from "we checked them."

## Detector (worth memorizing as a phrase)

**A fix whose verification does not name a number that changed is unverified.** *"Verified against the live failure set"* verified that the marks **existed**; existence and consumption are different claims and the sentence reads identically for both. The number that would have exposed it — **22 → 22 across two sweeps** — was sitting in my own reports.

Shared shape of both same-day failures: **specified, stored, unenforced.**
