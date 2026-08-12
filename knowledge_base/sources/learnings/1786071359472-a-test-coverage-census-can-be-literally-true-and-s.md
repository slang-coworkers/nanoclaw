# A test-coverage census can be literally true and still answer the wrong question — enumerate how the HARNESS spells the target

From shader-slang/slang#12395 (2026-08-07). A triage comment stated: *"40 files under `tests/` mention `noinline` and **none** targets CUDA (control: 155 mention `-target cuda`)"* — offered as the explanation for why the bug survived. I re-verified it, got the same zero, and **believed it through two rounds** before catching it.

## The reconciled numbers

Of 40 pre-existing `noinline` test files:
- **0** contain the string `-target cuda` — the claim was *literally true as written*.
- **12** actually compile and run these functions through CUDA.

The 12 spell it inside a test directive:
```
//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=CHECK):-cuda -compute -output-using-type
```

## ⛔ Why two rounds of "fixing the grep" still returned 0

My first correction was the known two-spelling trap (`-target cuda` vs bare `-cuda`). It still reported **0**, because in a slang-test directive the flag follows a **COLON**, not whitespace:

```bash
grep -rlE '(^|[[:space:]])-cuda([[:space:]]|$)' tests/…   # → 0   WRONG
grep -rlE '[:[:space:]]-cuda([[:space:]]|$)' tests/…      # → 12  correct
```

`:-cuda` defeats any word-boundary-on-whitespace pattern. A repeated zero from a "fixed" pattern felt like confirmation; it was the same blind spot wearing a new regex.

## The generalizable rule

**"No file matches string X" is not "no test exercises target X."** The first is a fact about your pattern; the second is the question you care about. Before reporting a coverage zero:
1. Open one file that you *know* exercises the target and read how the harness actually spells it. Don't derive the pattern from how you'd write it.
2. Require a positive control that finds a file you have independently confirmed — a control that returns non-zero on the *whole tree* (155 hits for `-target cuda`) does **not** prove the pattern can find the subset you're asking about.
3. Treat a zero that survives a pattern fix as *more* suspicious, not less.

## ⭐ The corrected story was strictly more interesting than the wrong one

The gap did not survive for lack of CUDA coverage. It survived **despite** 12 files executing these functions on real CUDA hardware — because those tests compare output buffer contents, and a dropped inlining hint changes performance, not results. No assertion they could reasonably make would have caught it, which is why a compile-only check on emitted source is the right regression test.

That also turned the correction into *support* for the fix: those 12 files now pass 48/48 with the specifier added, which is stronger non-regression evidence than any compile-only census would have been. **Chase down a census discrepancy even when the wrong number favours your narrative** — here the true number was better for the change.

## Posting the correction

The wrong census was live in a public triage comment as the stated reason for survival, so it needed correcting publicly. Two rules mattered: state it as a *shared* measurement failure (I reproduced the same zero twice), and do **not** edit the other tier's comment even though `nv-slang-bot[bot]` is a shared identity — post a new comment. Their record is theirs.
