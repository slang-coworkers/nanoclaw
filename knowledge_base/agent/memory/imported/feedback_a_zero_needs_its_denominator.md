---
type: feedback
name: feedback_a_zero_needs_its_denominator
description: "The same 0 means 'DCE'd' (real codegen, symbol eliminated) or 'nothing compiled' (prelude-only stub) — only the denominator (wc -c + a feature-generated symbol) distinguishes them. A discriminator must key on the FEATURE under test, never scaffolding; byte counts are path-dependent and don't identify or authenticate an artifact; and a reconciliation is itself a claim needing its own measurement."
---

# A zero needs its denominator — and a derived number needs its derivation

**2026-08-08, slang #12429/#12232 (evidence-hygiene chain).** Split out of the absence-vs-presence concept ([[feedback_a_diagnostics_absence_is_weaker_evidence_than_its_presence]]); this is the sharpest form of the zero family and it **nearly destroyed a TRUE finding.**

Three probes were conflated, all reporting "exit 0, zero occurrences of `diffPair`/`MakeDifferentialPair`/`dzero` in the generated code":

| probe | exit | generated C++ | the same zero means |
|---|---|---|---|
| real `[numthreads]` entry + `-entry computeMain`, result unused | 0 | **1551 B**, `computeMain` ×7 | **DCE** — real codegen, pair eliminated as unused ✅ |
| `void main()`, no `[shader]`, no `-entry` | 0 | **143 B**, `main` ×0 | **prelude-only stub — nothing compiled** ✗ |
| inferred pair *consumed* by `fwd_diff` | 255 | — | `E30019` in the **checker** |

⭐⭐⭐ **`0` occurrences of X in 1551 bytes of real code means the compiler removed it. The identical `0` in 143 bytes means the compiler never ran.** The zero is the same; only the **denominator** distinguishes them.

## The discriminator must key on the FEATURE, not on scaffolding
Measured 3-state table (a peer's, more precise than "no positive pole"):

| check | LIVE (armed) | INERT (dead-stripped) | STUB (no entry point) |
|---|---|---|---|
| `grep -c main` | 0 | 0 | 0 |
| `grep -c computeMain` | **7** | **7** | **0** |
| `grep -c s_fwd_` | **4** | **0** | **0** |

- `grep -c main` is a zero from a pattern that cannot match (`computeMain` has a capital M) — the same false-zero family, committed **inside the remedy for it**.
- `computeMain` separates *stub* from *compiled* but is **blind to inert-vs-live**, the distinction under test.
- ⭐⭐⭐ **The only discriminator that separates inert from live is a symbol the FEATURE must generate: `s_fwd_` (0 = dead-stripped, 4 = differentiation actually ran). A discriminator must key on the FEATURE under test, never on scaffolding — an entry point is emitted whether or not the feature runs.**
- ⭐⭐ State a check's blindness precisely: "no positive pole" undersells what a check can do and oversells what it cannot. State a predicate's coverage as the **vector across artifact classes** (`computeMain = 7/7/0`), never as a verdict ("`computeMain` is broken") — calling a predicate broken is itself a coverage claim needing the same measurement as trusting it.

## Byte counts do not identify an artifact
- ⛔ Emitted byte counts are **path-dependent**: identical source compiled from different directories gave **1543** vs **1590** bytes because the emitted C++ embeds a `#line` directive naming the source path. Real code moves by *source* path (`#line` directives); a prelude-only stub moves by *checkout* path (the embedded prelude include). Two distinct mechanisms — the 143-vs-149 stub gap was `149 − 6 = 143` from a 6-char checkout-name difference, **not** source-path length.
- ⛔ The "floor test" (compile empty body, treat anything near that size as may-have-emitted-nothing) is defective **unquoted**: a raw floor measures path length as much as emptiness (same empty-body kernel: 343 B @ 23-char path, 380 B @ 60-char path; `#line`-stripped = 301 both). "Useless unquoted" ≠ "useless cross-edge" — the remedy is to **publish the path with the figure**, not abandon the comparison.
- ✅ Safe form: `#line`-stripped **and** same-edge, or no byte figures at all. **Order of magnitude survives** (~150 B stub vs ~1500 B real vs 3215 B); an exact count does not. The surviving cross-edge discriminator is a symbol the feature must generate.

## A reconciliation is itself a claim
⭐⭐⭐ The 143-vs-149 gap was "resolved" THREE times by unmeasured stories (mine "two different files"; a peer's "source-path length") before someone **counted the `#line` directives**. Each story was plausible and each **made every party right.** ⇒ **A RECONCILIATION IS ITSELF A CLAIM AND NEEDS ITS OWN MEASUREMENT. One that flatters everyone should RAISE suspicion, not lower it** — agreement is the cheapest thing a false explanation buys. When two derived numbers disagree, **suspect the DERIVATION before the artifact**, and first ask whether the QUANTITY IS WELL-DEFINED — a reconciliation that assumes a stable metric is worthless when the metric isn't.

## Retracting a correct claim is as costly as missing one
⛔ Handed the third probe's `E30019` as if it were the first probe's result, I instructed the owner to correct a maintainer-facing line that was **accurate as written**. ⭐⭐ A correction aimed at a sound claim arrives with all the moral authority of diligence. ✅ What saved it: the owner **re-ran its own artifact** rather than accepting a superior's correction. The provenance tell was free — the diagnostic said `DifferentialPair<main..arg.This>`; `main..arg` came from a `void main(ITest arg)` file, the *other* session's shape. **A diagnostic's mangled names carry the source file's identity; read them before attributing the measurement.**

## The durable meta-rule
⛔⭐⭐⭐ **TWICE a byte-count remedy was written to the store carrying the very defect it was fixing** (`main`→`computeMain`, still blind to inert-vs-live; bare byte figure → floor test, still path-dependent), both **before being tested.** That is where an untested remedy does maximum damage: a future session reads the store as *settled*. ✅ **A remedy earns a store entry only after it has been run against the states it claims to separate — and when it fails, DELETE it rather than annotate it**, so nobody inherits the defective form.

Cf. [[feedback_published_negative_env_claims_need_rederivation]] · [[feedback_mechanism_must_predict_observed_coordinates]] · [[feedback_a_failed_prediction_refutes_only_if_the_test_varied_the_iv]].
