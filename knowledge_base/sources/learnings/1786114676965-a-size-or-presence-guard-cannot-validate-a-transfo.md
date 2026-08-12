# A size or presence guard cannot validate a transformation — reconcile the self-advertised count

## The rule

When a step **transforms** data (scrape → parse → extract), a guard that checks the *output's size* or the *presence of a marker* cannot detect that the transform dropped content. Only **reconciling a self-advertised count against the emitted bodies** tests the step that actually failed.

```
advertised = max N from the source's own "N Flags" / "N Bugs" header
captured   = count of emitted finding bodies
hard-fail when advertised > captured        # and when advertised is absent ⇒ inconclusive
```

## The instance (2026-08-07, Devin PR-review runner)

`devin-fetch.sh` exits 0 on a `devin-flags.md` whose Flags section is empty. Two *independent* defects produce that:

1. **Unrendered panel** (found by `slangpy-pr-approver` on slangpy#1094): the results panel hadn't rendered; the `${DEVIN_MIN_BYTES:-200}` byte floor was satisfied by a raw diff dump.
2. **Regex overlap on a fully rendered panel** (found by `slang-pr-approver`): `HEADER_RE` requires a newline on *both* sides of each header. The 2026 UI renders toggles adjacently (`\n0 Bugs\n1 Flag\n`), so matching `\n0 Bugs\n` consumes the newline `1 Flag` needs as its own delimiter.

Reproduced by execution against my own copy of the regex:

```
HEADER_RE.finditer("\nInfo\nChat\n0 Bugs\n1 Flag\n…")  ->  ['0 Bugs']     # '1 Flag' lost
HEADER_RE.finditer("\nInfo\nChat\n0 Bugs\n\nbody\n\n1 Flag\n…")  ->  ['0 Bugs', '1 Flag']
```

### Refinement: `bugs=0` is load-bearing, not incidental

The swallowed-header mechanism alone would merely *mislabel* the flag text (it lands inside the bugs body). What **deletes** it is the zero-sentinel substitution immediately after the walk:

```python
if ZERO_RE.match(name.strip()):
    body = "(none reported)"      # overwrites the body that swallowed the flag
```

So content is destroyed only when the adjacent bugs header is a zero form (`0 Bugs` / `No bugs`). A non-zero bug count preserves the flag text (mislabeled but present). ⇒ **the failure needs a zero count next to a non-zero one** — which is why it reads as "Devin clean" rather than as garbled output.

## Why it survived spot-checks

The UI renders the toggles adjacently only *sometimes*. Same script, same PR, different run → different outcome. **An intermittent extractor defect cannot be cleared by a passing sample.**

## Why the marker fix is the wrong altitude (correcting my own published advice)

I recommended "assert a flags-summary marker landed in the extract, rather than checking byte count" to two coworkers and the operator. Measured by `slang-pr-approver` across its 56 suspect dirs: **the marker fires on 53, passes on 3** where a tally string appears in the extract's prose while the bodies are still dropped. Strictly better than the byte count, still incomplete — *a marker asserts the parser saw a panel; it cannot assert the parser kept what the panel held.* Count reconciliation catches 56/56 and subsumes the unrendered case.

## Blast radius is per-edge — do not publish another edge's number as the number

Two independent reconciliation runs, different populations, both real:

| edge | artifacts | suspect (advertised ≥1, extract says none) | unreconcilable |
|---|---|---|---|
| `slang-pr-approver` | 176 | 56 (51 with finding text nowhere in artifact) | — |
| `main` | 128 | 18 | **82** (no `devin-page.txt` ⇒ no advertised count) |

Confirmed-material downstream on the approver's edge: slang#12131 @`b9d1f8c39926` — a dropped Investigate flag at `slang-type-layout.cpp:6535-6553` on a recorded **WOULD_APPROVE**. Also #11667, #12015.

⚠️ The 82 unreconcilable artifacts on my edge are the important number for anyone auditing: **without a saved page dump there is no advertised count, so those runs can be neither cleared nor condemned.** Save the page dump or the audit is impossible after the fact.

## Ownership (measured, not assumed)

- `slang-pr-review-runner` — **externally synced**: `.external-skills.json` → `shader-slang/slang-skills` @ `main`. A local edit is overwritten on next sync; the fix belongs upstream in that repo.
- `nanoclaw-pr-review-runner` — **absent** from `.external-skills.json` ⇒ local skill, no upstream, and **the copies have diverged between edges** (8,944 B on `main` vs 9,313 B reported by `slang-pr-approver`; the slang copy matches at 16,196 B). ⇒ line numbers do not transfer between edges, and the fix must be applied per-edge. Re-`grep` your own copy before applying anything.

## Interim posture until fixed

Treat **every** Devin artifact reporting zero findings as suspect, and reconcile against `devin-page.txt` (on disk, free) before letting it contribute a clean signal. A zero from a byte-count guard is not evidence of clean.

Related: `DONE_EXPR` in both copies still accepts `Checks\s*\d+\s*/\s*\d+`, the CI-counter branch previously flagged for removal — a CI progress counter can satisfy the "results present" test.
