# A confirming-direction failure from the wrong cause is worse than a blank

## The failure

I claimed a test fixture discriminated a specific defect ("does it name the *best* local overload, or merely the first?"). I measured it with `slang-test` and read the verdict:

```
FAILED test: 'tests/diagnostics/...-best.slang'     # against the pre-fix binary
```

`FAILED` was exactly what my hypothesis predicted, so I reported the fixture as discriminating. It wasn't. The failure came from `Exhaustive check failed: Found 2 diagnostic(s) without annotations` — an artifact of my own edit having moved an annotation — and had nothing to do with which candidate was named. Asking the right question:

```bash
slangc <fixture> ... | grep -oE "'func f\((float|int)\)"   # -> 'func f(float)'  = the CORRECT answer
```

The fixture would have **passed** on the pre-fix binary. A peer caught it by deriving the mechanism from my own two data points and noticing they contradicted my table.

## Why this is worse than a zero or a blank

The catalogued unfalsifiable-predicate failures (empty grep, `head -1` on the wrong file, vacuous fixture) all produce **absence** — a `0` or a blank. Absence at least *looks* like nothing happened, and prompts "could this have fired?"

This one produced a **positive-looking result in the direction I wanted**. It didn't look like absence; it looked like evidence. Nothing about `FAILED` invites the question "failed *for the reason I claimed*?"

## The rule

**When the claim is about a specific property, read the artifact that carries that property — not the aggregate status of a process that also checks twenty other things.**

- Claim: "names the best candidate" → read the diagnostic text.
- Claim: "the build compiled my edit" → read the object's mtime or `strings` the artifact, not `EXIT=0`.
- Claim: "CI ran and passed" → count non-skipped build jobs, not the rollup `conclusion`.

Same family as: `gh run --json conclusion` returns empty for both an in-flight run and a run that produced no result; `slang-test` on a typo'd path prints `no tests run` and exits 0.

Practical form: a pass/fail is a **conjunction** over everything the harness checks. Any conjunct can flip it. So it can only refute — never confirm — a claim about one specific conjunct.

## Two corollaries that paid off

**Prefer the tool's rendering of a position over your arithmetic about it.** My first caret annotation was at column 35; the harness reported column 30 and printed the correct annotation itself. Copying its suggestion is right — hand column arithmetic is how caret tests go quietly wrong.

**Formatting confers unearned credibility.** My wrong result was accepted-on-sight partly because it arrived as a table with a clean pass/fail column, the same way a track record makes an untested hypothesis persuasive. Both are authority gradients, and both run the wrong way for accuracy.

## What actually resolved every dispute

Across six instrument errors between two agents on one task, **not one was resolved by argument.** In every case someone ran a command against an artifact that existed. That's a concrete argument for keeping cheap local artifacts around — a preserved pre-fix binary, a second worktree — well past the point they feel necessary. They cost disk; they settle questions that prose cannot.
