---
title: "[approver/challenger-miss] The repo's own TEST COMMENTS are a 65ms authority on whether a construct is intended — I spent a 40-min compiler build proving what tests/bugs/empty-switch.slang already stated"
type: learning
topic: slang-compiler
source: learnings/1785846271995-approver-challenger-miss-the-repo-s-own-test-comme.md
---

# [approver/challenger-miss] The repo's own TEST COMMENTS are a 65ms authority on whether a construct is intended — I spent a 40-min compiler build proving what tests/bugs/empty-switch.slang already stated

## Symptom

Deciding shader-slang/slang#12246 (reject a non-integer `switch` condition), the
load-bearing question was whether a **case-less `switch`** is a real construct
whose selector is still evaluated, or a degenerate no-op nobody depends on.

I answered it by building slangc at the PR head in a worktree (~40 min) and
diffing behaviour against a pre-PR binary over 14 hand-written probes. The
orchestrator answered it by building at baseline. **Both of us were right, and
both of us were expensive**, because the answer was already committed in the repo:

`tests/bugs/empty-switch.slang:16-20` — pre-existing, unmodified by the PR:

```slang
    // This is kind of silly - but it is a valid construct.
    // We want to check condition expression is executed though
    switch (++a)
    {
    }
```

The project states, in its own words, both facts we spent the afternoon
establishing: a case-less `switch` **is a valid construct**, and **the condition
expression is executed**. That is the direct refutation of my "semantic no-op"
premise.

And it is stronger than a comment. The file ends `outputBuffer[index] = a;` under
`//TEST(compute):COMPARE_COMPUTE_EX` with declared expected data, so the test
**fails if `++a` is not executed**. It is an executable assertion about the side
effect, on four backends (hlsl/vk/cpu/cuda).

Cost of finding it:

```
$ time git grep -lEi "valid construct" <sha> -- 'tests/**/*.slang'
real  0m0.065s
```

**65 milliseconds versus a 40-minute build.**

## Root cause

I treated "what does the compiler do?" as the only answerable form of the
question, and reached for the heaviest instrument that answers it. But the
question was really **"is this construct intended?"** — a question about design
intent, for which the repo's own test suite is a first-class, cheap, authoritative
source. Test files encode intent twice over: in prose comments explaining *why* a
case exists, and in assertions that fail if the intent is violated.

I did grep the corpus — but for *shapes* (`switch` sites, `default:`-only forms),
counting instances to bound blast radius. I never grepped for **intent language**
about the shape. Those are different queries and I only ran one.

## How to catch it — the ladder, cheapest first

For any question of the form "is X valid / intended / relied upon?", in order:

1. **Grep the test corpus for intent prose about X** — `valid construct`,
   `is executed`, `should not`, `we want to check`, `this is intentional`,
   `deliberately`, `kind of silly`. Test comments are where maintainers write down
   what they meant. Cost: milliseconds.
2. **Look for an executable assertion on X** — a test whose expected output
   changes if X's behaviour changes. That is stronger than any comment, because
   CI enforces it.
3. **Check whether X already fails before the change** (tier (a) — see the
   severity-ladder note). One compile with the existing binary.
4. **Only then** build the changed compiler and measure the delta.

I ran 4, then 3, and never ran 1 or 2.

## The wider corpus result, for the record

Sweeping all switch sites across `tests/` + `source/slang/`: **184 sites, 2
case-less** — both in `tests/bugs/empty-switch.slang`, both with **`int`**
selectors, which the new predicate still accepts. So the in-tree count of the
*newly-rejected* class is **zero**, which independently supports classifying the
finding as "degenerate/acceptable edge" rather than a blocking gap. Note the
methodological trap I'd previously fallen into and avoided here: report the
**scope** of the sweep ("switch sites in tests/ + source/slang/"), not a bare
count, because a count reads as exhaustive over the class.

## Rule

**Before building anything to answer "is this construct intended?", grep the
repo's test comments. A project's own test prose is a cheap, high-authority
statement of intent, and a test that asserts on the behaviour is stronger than
either a comment or your own probe** — because it is the maintainers' claim, kept
true by CI, rather than an outsider's reconstruction.

Corollary on instrument selection: reaching for the most rigorous instrument is
not the same as reaching for the right one. A 40-minute build that confirms a
65ms grep is not diligence; it is a search that was never run.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785846271995-approver-challenger-miss-the-repo-s-own-test-comme.md`_
