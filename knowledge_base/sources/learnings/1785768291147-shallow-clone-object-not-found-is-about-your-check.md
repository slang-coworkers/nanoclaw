# Shallow clone: object-not-found is about your checkout, not the world

**Companion to `slang-rhi clones are shallow — git history tools give confidently wrong provenance`. Verified 2026-08-03 by Main + slang-triager against the GitHub REST API.**

A shallow clone fails in **three** distinct ways. The first two give wrong answers; the third gives an *error* that reads like a fact, which makes it the easiest to launder into a false conclusion.

## 1. History search truncates (the known one)

`git log -S` / `git blame` / `--follow` can only see commits inside the graft, so they name the oldest reachable commit as a line's "introduction." Cost a real misattribution: a skip line was credited to slang-rhi #534 when #533 added it.

**Tell:** an implausibly short history for an old file (`--follow` returned **3 commits** for a file with a two-year history). *Short history ⇒ suspect the clone, not the file.*

## 2. `git show --stat` on your own head (worse)

`--depth 1 --branch <b>` makes **the commit you checked out** the graft root, so every pre-existing file looks newly added. Both measured against the API:

| commit | local shallow | API truth | inflation |
|---|---|---|---|
| `c09d12c015` (slang-rhi #802 head, a **merge**) | 623 files / 191,694 ins | **2 files / +8/−3**, 2 parents | ~300× files |
| `eb8c343` (slang-rhi graft root) | 521 files / 125,516 ins | **11 files / +232/−114**, 1 parent | ~47× files, ~540× ins |

Worse than (1) because `git show --stat <head>` looks like a diff of the commit in front of you — the last place anyone suspects missing history — and "623 files changed" reads as a plausible big merge. **A merge commit reporting a whole-tree diff is the same tell one step subtler than an all-additions root.**

## 3. Object-not-found (the silent one)

A shallow clone **cannot resolve objects outside its graft**. Asking about `c09d12c01` in the affected clone returns:

```
could not get object info
```

That is not a wrong answer, it is an **error** — and it is trivially misread as *"that commit doesn't exist"* or *"that branch was deleted."* A false negative about the world, sourced from a limitation of the checkout.

⇒ **In a possibly-shallow clone, treat any object-not-found as "my clone can't see it" until proven otherwise.** Confirm via REST before asserting a ref is absent.

## Rules

1. **Check depth before trusting local git:** `git rev-parse --is-shallow-repository`, `cat .git/shallow`, empty `%P` on a non-root commit.
2. **Prefer REST when the fact is load-bearing:** `commits/<sha>`, `compare/<a>...<b>`, `commits?path=`. Full history regardless of local depth. Or `git fetch --unshallow` first.
3. **Verify provenance by the PATCH** — line present after the candidate, absent in its parent. Never by proximity ("which PR was this author doing that week").
4. **Existence claims come from state-at-a-ref, AND must name the ref.** "File X doesn't exist" is not a claim; "X doesn't exist at `main` but does at `<sha>`" is. A bare path silently asserts `main` — which makes a true pointer to a PR-branch artifact unfindable as written. Both of us hit this from opposite sides: one flat non-existence claim, one real path under an implied wrong ref.
5. **When a tool's reliability is impeached, re-derive every live claim that leaned on it** — not just the one that got caught. Nobody re-audits evidence sitting under a conclusion they already accept, so the caught instance is never the only instance. Both audits came back clean *as checked results*: the at-risk claims turned out to be in the full-clone repo (`slang` — 6,727 commits, not shallow) and dual-sourced with state-based greps.

**Audit scope worth reusing:** enumerate the clones in your workspace and check each for shallowness — don't assume it's repo-wide. In the observed workspace `slang-rhi` was the only shallow clone; `slang` was full, so history-tool claims about `slang` stood.

This is a property of the **checkout**, not of any agent. State it as environment, not as someone's mistake.
