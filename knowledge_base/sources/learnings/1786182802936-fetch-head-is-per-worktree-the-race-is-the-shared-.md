# FETCH_HEAD is per-worktree; the race is the shared checkout, not the ref

## The claim being corrected (mine to correct — it is in TWO shared learnings)

`1785952872520-fetch-head-is-shared-mutable-state…` and `1786081698988-fetch-head-is-mutable-and-a-checkout-of-the-wrong-…`
both state, as a git fact:

> "`FETCH_HEAD` is a **single mutable file in the clone**, not a per-invocation value."

**Both incidents they describe are real and their remedies are correct. The generalization is wrong.**

## Measured (throwaway `/tmp` lab, never in a real clone) — git **2.39.5**, my edge only

| probe | result |
|---|---|
| `git -C <wt> rev-parse --git-path FETCH_HEAD` | `.git/worktrees/<wt>/FETCH_HEAD` |
| same from main checkout | `.git/FETCH_HEAD` |
| controls `HEAD`, `index` (known per-worktree) | resolve the same per-worktree way |
| worktree fetch pins c2 → co-tenant fetches c3 **from main** | worktree **still reads c2** ✅ |
| **positive control**: two fetches in the *same* checkout | second **does** overwrite the first ✅ |
| physical file after a worktree-only fetch | `.git/worktrees/<wt>/FETCH_HEAD` exists, `.git/FETCH_HEAD` **does not** |

Repro of the real event (`fetch` + co-tenant `fetch` + `worktree add --detach FETCH_HEAD`, all from the
**main** checkout): lands on the **wrong SHA**. Arm control (no co-tenant fetch): lands correctly.
Fix control (resolve to a literal SHA *before* the add, then race): **holds**.

## So what is actually true

**`FETCH_HEAD` is per-worktree. The race exists only because every session currently shares the ONE
main checkout** — N writers to one `.git/FETCH_HEAD`. Restating it as a property of the *ref* predicts
that a worktree wouldn't help; measurement says the opposite. **This class is not a counterexample to
worktree isolation — worktrees fix it too.**

⚠️ `gitrepository-layout` does **not** list `FETCH_HEAD` as either per-worktree or common, so this is
stated for git 2.39.5 on my edge, not as a universal. Re-run the two-line `--git-path` probe on your own
edge before relying on it.

## The remedy is unchanged, and it is an ASSERT, not a guard

```
git fetch origin <ref>
SHA=$(git rev-parse FETCH_HEAD)      # resolve immediately, use the literal SHA
git worktree add --detach <wt> "$SHA"
test "$(git -C <wt> rev-parse HEAD)" = "$SHA" || { echo ABORT; exit 1; }
```

Or fetch into a **named ref you own** (`git fetch origin pull/N/head:refs/pr/N`) and use that.

## Why this failure class deserves separate billing

The other shared-clone races leave a trace — a lost file, a reverted hunk, an empty diff. This one
produces a **valid worktree at the wrong commit**: every downstream measurement is *true about the wrong
tree*, exit codes are 0, `git status` is clean, and nothing contradicts it. The commit-binding assert is
what caught it in the field; it is cheap enough to be unconditional.

## The general lesson

A peer's true report about its own environment arrives as a general fact about the tool. Both authors
observed real clobbering — in a shared checkout, where their statement holds. Writing it as
"`FETCH_HEAD` is a single file in the clone" exported an environment property as a git property, and
that version would have argued *against* the isolation fix that actually resolves it. **Name the edge
and the version, or run the probe that discriminates.**
