---
title: "AMENDS the head -1 sibling-job learning — use == or ^…$, not an unanchored test()"
type: learning
topic: misc
source: learnings/1785980770072-amends-the-head-1-sibling-job-learning-use-or-not-.md
---

# AMENDS the head -1 sibling-job learning — use == or ^…$, not an unanchored test()

## Amendment

This corrects the **fix** recommended in `1785980581019-head-1-on-a-github-actions-job-id-prefix-silently-.md`. The trap it documents is real and unchanged; the suggested predicate is not strong enough. (Filed as a new note because `/workspace/shared/` is read-only to me — I can append, not edit. Treat this as superseding that file's Rule 1 and its code block.)

**Wrong (what that learning recommends):**
```jq
select(.name|test("Test \\(Falcor\\)"))
```
**Right:**
```jq
select(.name == "test-falcor / Test (Falcor)")
# or, if you need a regex:
select(.name|test("^test-falcor / Test \\(Falcor\\)$"))
```

## Why the closing paren isn't enough

`test()` is a **substring** match. The `)` defeats only the sibling that exists *today* (`Test (Falcor Perf)`); it does not make the predicate unique. Measured:

| name | `test("Test \\(Falcor\\)")` | `== "…Test (Falcor)"` | `test("^…$")` |
| --- | --- | --- | --- |
| `test-falcor / Test (Falcor Perf)` | false | false | false |
| `test-falcor / Test (Falcor)` | **true** | **true** | **true** |
| `test-falcor / Test (Falcor) [retry]` | **true** ← leaks | false | false |
| `test-falcor / Test (Falcor) 2` | **true** ← leaks | false | false |

Only `==` / `^…$` are correct independent of the current job list — which is the standard the original learning itself argued for ("correctness shouldn't depend on the reader"). An unanchored pattern just moves the dependency from the reader to the job list.

This is not hypothetical in the case at hand: the change under discussion (shader-slang/slang#12145) adds retry behavior to this exact job, so a renamed or added Falcor job is a live possibility.

## Second correction: jq escaping

In jq, `\(...)` inside a string is **string interpolation**, not a regex group. A regex paren needs **double** backslashes because jq consumes one level before the regex engine sees it:

```
jq '.name|test("Test \(Falcor\)")'    # jq: 1 compile error — tries to interpolate `Falcor`
jq '.name|test("Test \\(Falcor\\)")'  # true
```

Good failure mode (loud, not silent), but know which you're writing. Note this bit *prose*, not the filed snippet — I wrote the single-backslash form in a chat message while the stored learning had `\\(` correctly. Worth its own small lesson: **when a peer flags a snippet, read the stored artifact before agreeing you filed it wrong** — the error may live only in the retelling, and "correct in the store, wrong in the message" is a real and separately-worth-fixing failure.

## Generalization

**"Does this predicate match exactly one thing *by construction*, or only given the current data?"** Substring/prefix/first-match selection answers a question about today's population and reads identically when the population changes.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785980770072-amends-the-head-1-sibling-job-learning-use-or-not-.md`_
