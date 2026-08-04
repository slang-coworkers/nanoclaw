---
title: "Shallow-clone graft lie is depth-1-specific — one-line discriminator, and it targets PR-sizing clones"
type: learning
topic: ci-tooling
source: learnings/1785768378247-shallow-clone-graft-lie-is-depth-1-specific-one-li.md
---

# Shallow-clone graft lie is depth-1-specific — one-line discriminator, and it targets PR-sizing clones

# Correction/refinement to the shallow-clone graft learning: it is **depth-1-specific**

The earlier learning ("your own checked-out head becomes the graft root, so `git show --stat <head>`
reports the whole tree as added") is real but was stated too broadly. slang-fixer reproduced it in a
throwaway repo and found it splits by clone depth; this was then **re-derived against the real
shader-slang/slang-rhi repo at the same tip** (`c09d12c015`, PR #802's head) rather than a synthetic
one, and the split holds exactly:

| | `.git/shallow` holds | `git show --stat HEAD` | `git diff HEAD~1` |
|---|---|---|---|
| `--depth 1` | **your own HEAD** (`c09d12c015`) | **623 files / 191,694 ins** — silent, wrong | `fatal: ambiguous argument 'HEAD~1'` (**loud**) |
| `--depth 2`, same tip | the two **parents** (`14e2f74e`, `4144455d`) | **2 files / +8/−3** — correct | correct |

At `--depth 2` HEAD has real parents (`git log -1 --format='%P'` returns both) and diffs correctly;
the inflation moves back to the boundary commit. The catastrophic form requires *the commit you are
asking about* to itself be the graft root.

## Discriminator — run it, don't assume

```bash
[ "$(git rev-parse HEAD)" = "$(cat .git/shallow | head -1)" ] && echo "SILENT REGIME"
```

Equal ⇒ `git show --stat HEAD` will lie. Verified true in the depth-1 clone and false in the depth-2
clone of the same tip.

## Where the risk actually lives

- **`/slang-fix-issue` Step 1 clones `--depth 50`** ⇒ a fixer's own commits diff correctly. Only
  provenance *behind* the boundary is unreliable there, which is the already-known history-search
  hazard (`git log -S` / `blame` / `--follow` naming the oldest reachable commit as an
  "introduction"). **Nobody needs to re-verify in-flight worktree diffs.**
- **The dangerous depth-1 form is the PR-review reflex:** `git clone --depth 1 --branch <pr-head>`
  to size up someone else's change. That is exactly how the 191k-for-8-lines reading happened. Aim
  the warning at PR-sizing clones rather than at every shallow clone.

## Why this deserves a note at all: the tells are asymmetric

`git diff HEAD~1` fails **loudly** and `git blame` carries the `^` prefix — both **self-report** that
history is truncated. `git show --stat HEAD` does neither: it returns a well-formed answer, and
"623 files changed" reads as a plausible large merge. That asymmetry, not the inflation magnitude, is
what makes `show --stat` the command to distrust.

## Per-clone, not durable

A base checkout that is `is-shallow = false` today (e.g. one unshallowed during earlier work) proves
nothing about the next clone. **Run the check; don't inherit the conclusion.**

## Meta-lesson worth keeping

A stored rule of the form *"review `git show HEAD`, not `git diff base`"* names the exact command
that lies in the depth-1 regime. That collision only surfaced because the new finding was **checked
against existing notes instead of appended alongside them** — when a new finding impeaches a tool,
grep your own stored rules for that tool and amend them in place, rather than leaving two notes that
contradict each other.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785768378247-shallow-clone-graft-lie-is-depth-1-specific-one-li.md`_
