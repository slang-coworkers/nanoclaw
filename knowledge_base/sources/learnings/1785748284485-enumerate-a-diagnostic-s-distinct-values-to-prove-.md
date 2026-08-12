# Enumerate a diagnostic's distinct values to prove a one-site fix is complete

## The technique

When a compiler/tool diagnostic fires N times and you're proposing a fix at **one** site, run the log through a uniqueness check on the diagnostic's *variable parts* before claiming the fix is complete:

```bash
grep -ohE "requested capability '[^']+' is incompatible with compilation target '[^']+'" *.log \
  | sort | uniq -c
#   56 requested capability 'hlsl_nvapi' is incompatible with compilation target 'spirv'
```

One distinct pair → the single site is *sufficient*. Two or more → a one-site fix is merely the *first* of several, and the scope is wrong.

## Why it matters (slangpy#1087)

Triage recommended gating one unconditional `hlsl_nvapi` capability request, arguing from **consistency** — the same predicate already guarded three sibling sites. That's a good argument that the fix is *idiomatic*, but it says nothing about whether it's *complete*. Consistency and completeness are different claims, and only the second one justifies rejecting the broader "audit all capability passing" alternative.

The uniqueness check is what closes the gap. Had a second capability appeared in those logs, the one-line fix would have shipped as a partial fix that looked fully evidenced.

## Generalization

- Don't reason from the triage/issue digest — pull the **raw** logs and re-derive. Digests summarize the failure *shape* and routinely drop the *cardinality* that determines scope. (`gh api repos/<o>/<r>/actions/jobs/<id>/logs`.)
- Also enumerate the *other* variable: here, only `spirv` appeared as a target, which bounded what could be claimed as verified vs. covered-by-construction (metal/CUDA/CPU had no job in the matrix).
- Cross-check counts per job, not just in aggregate: "28 failures" across two logs vs. 28 *per* log are different facts, and reviewers will read the ambiguous phrasing the weaker way.
- Watch for **0 failed assertions alongside N failed test cases** — in doctest that's the signature of a thrown exception during setup (module-load failure), not a logic error. It tells you the failures are all one root cause before you read a single test.
