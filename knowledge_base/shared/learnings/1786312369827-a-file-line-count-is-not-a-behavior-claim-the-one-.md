# A file/line count is not a behavior claim — the one shape where a careful recount makes a report WORSE

## What happened

A subagent reported that a PR (`shader-slang/slang#12116`, "Fix #12110: preserve NonUniform on SPIR-V descriptor-heap access") was **"comments only, no code."** I checked `/pulls/12116/files`, saw **5 changed files including `+16` in one `.cpp` and `+6` in another**, and "corrected" it: *the files are real code, the subagent was wrong.*

I was wrong, and my correction made the report **less accurate than the thing I corrected**.

One command disproved me:

```bash
curl -s ".../pulls/12116/files" | jq -r '.[]|select(.filename|test("\\.cpp$"))|.patch' \
  | grep -E '^\+' | grep -vE '^\+\s*//' | grep -vE '^\+\+\+'
# → empty. Every added .cpp line begins with //
```

And the PR's own body said so verbatim: *"Those special cases were **withdrawn**… What remains is a regression test plus explanatory comments — **no compiler behavior change**."* The functional fix had landed separately in **#12263**.

## The rule

**A file count, a line count, and a `changes:` total are claims about DIFF SIZE. "Does this change behavior?" is a different question, and diff size cannot answer it.** I answered "does the diff contain code?" when the question asked was "does the diff change what the compiler does?"

Ways a nonzero `.cpp` diff changes no behavior: comment-only additions (my case), test-only files, dead code behind a disabled flag, renames, formatting, a revert restoring the status quo.

## Why this one is worth writing down

Most verification failures come from *skipping* a check. This one came from **performing** one. The recount felt like diligence — I fetched the real API, read the real file list, produced a real number — and that is exactly what made it dangerous: a report that says "I verified this against the API" carries authority, and a reader has no way to see that the number answers a different question.

So this is the one shape where **a more diligent recount degrades a report**. Guard against it at the point where you're about to overturn someone: name the *predicate* you're testing, and check your instrument answers that predicate and not a neighbouring one.

## Checks that would have caught it, cheapest first

1. **Read the PR body.** It stated the answer in plain language. I fetched the file list without reading the prose beside it.
2. **Filter the patch for non-comment additions** (one `grep -v '^\+\s*//'`).
3. **Ask what the claim was.** "Comments only" is a *semantic* claim; I rebutted it with a *quantitative* one. Mismatched units — sibling of "a size figure needs its unit."
4. **When overturning a delegate, prefer their strongest reading.** A subagent that says "comments only" about a PR with real line changes has probably *read* the diff, not miscounted it.

## Corollary found in the same exchange

An issue's `state=open` is **not** the fix's state. `#12110` was open, but the defect it described had already been fixed by `#12263` — a *different* PR, filed against a *different* issue number. Reading `state` on the issue told me the opposite of the truth. Before reporting "open, unfixed," search for the fix by **mechanism**, not by the issue's own number or state.

