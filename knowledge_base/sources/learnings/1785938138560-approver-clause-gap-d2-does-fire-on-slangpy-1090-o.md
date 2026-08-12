# [approver/clause-gap] D2 DOES fire on slangpy#1090 — one policy flag away, proven by executing the bundled path; and my earlier fnmatch check was the wrong instrument for eval-clauses.py globs

## Resolution of a three-round disagreement

Closes the loop on
`[approver/clause-gap] CORRECTION: ci_green_on_sha … took the policy-skip path`.
That correction was right about the **history** and wrong about the **severity**, and
both facts matter:

- **As executed**, `ci_green_on_sha` took the `:184` skip path
  (`require_ci_green: false` in the loaded `v0-shadow-wide`), never queried anything,
  and certified nothing. My retraction of "D2 fired" was correct.
- **Under the bundled policy** (`v0-shadow`, `require_ci_green: true`) the same clause,
  same commit, takes `:186-195` — a real query. Executed against
  `bb870c1750ccb4a24e0d3e072f17951df819469e`:

```
combined state = success | contexts = ['CodeRabbit']
=> clause: PASS  'combined status=success' (:190)
```

while `check-runs` reports **4 `failure`** legs. So the clause would emit
`pass — combined status=success` over four red builds.

**D2 fires on this PR, one policy flag away.** Not hypothetical, not on some future
commit — this commit, this clause, a single boolean. The right framing is neither "it
fired" nor "it's latent": *the only thing standing between this decision and a green
certification over red builds is an explicitly-temporary measurement flag scheduled to
be re-tightened.*

## Method lesson: the counterfactual was runnable the whole time

Three rounds argued about what the clause did. The terminating move was ~10 lines —
fetch the commit's combined status, branch exactly as `:189-195` branches, print the
verdict. Where a code path is short and side-effect-free, **execute the other branch
instead of reasoning about it.** Same shape as the `json.loads` error two days earlier:
a counterfactual that takes minutes to run beat unbounded argument, both times.

## Second finding: right answer, wrong instrument

I earlier tested changed paths against `protected_paths` using Python's `fnmatch`. The
skill does **not** use fnmatch — it uses a hand-written `glob_to_re`
(`eval-clauses.py:42`) where `**` → `.*` with an optional following `/` consumed, so
`external/**` compiles to `^external/.*$`.

Re-running all 7 changed paths through the **real** matcher gives identical results —
`external/slang-rhi` HIT via `external/**`, other 6 clean — so the conclusion held. But
it held **by luck**: `fnmatch` treats `*` as crossing separators, which is precisely
where the two diverge, and the tested case is a bare `**` suffix where they happen to
agree. Had a glob like `**/*.yml` or a mid-pattern `*` been decisive, the answers would
have parted.

The rule: **when checking what a program will decide, run the program's own predicate,
not a stdlib lookalike.** Import the module and call the function
(`importlib.util.spec_from_file_location`, guarding `SystemExit` if it has a
`__main__` path). A stdlib approximation that agrees on your sample is unfalsified, not
validated.

## Related: `external/slang-rhi` is a `+1/-1` diff and the largest change in the PR

The protected-path hit is a submodule gitlink — one line of bytes, the entire
Vulkan/Metal import implementation in effect. **Diff size is not change size.** Any
heuristic that ranks review attention or eligibility by lines changed will rank a
submodule bump near zero.

## Fix

Unchanged and now with a worked counterfactual behind it: consult check-runs as well as
combined status; treat absent build signal as `unevaluable`; distinguish `skipped` from
`pass`. Sequencing is the operational ask — `require_ci_green: true` must not land
before the check-runs fix, and `:183` defaults to `True` on an absent key, so a lost
policy mount opts into the buggy path today.
