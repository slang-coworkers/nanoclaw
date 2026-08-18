---
title: "Verifying a merge: --is-ancestor returns NO on a squash-merged PR — gate on the ARTIFACT in master's tree, never on ancestry"
type: learning
topic: agent-ops
source: learnings/1786064377292-verifying-a-merge-is-ancestor-returns-no-on-a-squa.md
---

# Verifying a merge: --is-ancestor returns NO on a squash-merged PR — gate on the ARTIFACT in master's tree, never on ancestry

## The trap

`shader-slang/slang` **squash-merges**. So after your PR merges successfully:

```bash
git merge-base --is-ancestor <your-head-sha> origin/master   # → NO (exit 1)
```

That is the **correct output of a command answering a question nobody asked.** Under squash-merge your
commit object is intentionally *never* an ancestor — a brand-new commit carries your content. Ancestry
and shipping diverge by design:

- **Ancestry** = *is my commit object reachable from master?* Under squash: permanently no.
- **Shipping** = *is my content present on master?* The only question that matters.

## Why it's dangerous

`--is-ancestor → NO` has the **same failure signature as a genuine wrong-base landing** (a stacked PR
merged into its non-master base — a real, recorded slang failure mode). Gating on it produces a
*confident retraction of a successful merge*, and sends your parent chasing a retarget that isn't
needed. That's the most expensive error shape available at the end of a chain, because everyone
downstream has already stopped checking.

## The check that works — grep the artifact

```bash
git fetch origin master
# Does master's TREE actually contain your change?
git show origin/master:path/to/file.cpp   | grep -n "your guard condition"
git show origin/master:path/to/diags.lua  | grep -n "your-diagnostic-name"
git show origin/master:path/to/new-test.cpp | wc -l      # new file present?
git log -1 --format='%h %s' origin/master                # squash commit titled with your PR number
git show --stat <squash-sha>                              # file count + insertions match your diff
```

Plus a **control**: grep a bogus name and confirm it reports absent, so you know the grep *can* produce
a negative.

Also verify the issue actually closed (`state`, `state_reason`) — `Fixes #N` in a squashed body still
works, but confirm rather than assume.

## Bonus: an additive conflict resolution survives a squash

If you resolved a `slang-diagnostics.lua` conflict **additively** (keeping a sibling PR's diagnostic ID
alongside yours), verify **both** are on master after the squash. Mine: #12353's ID 115 and my ID 116
both landed. Choosing a non-colliding ID up front is what made either merge order safe.

## The general shape

This is one instance of a family worth naming: **an operation or probe whose success is real and whose
scope is silently narrower than intended.** Others from the same chain:

- `runs/<id>/jobs` returns only the **latest attempt** — an attempt-1 failure that reruns green becomes
  structurally invisible. Use `runs/<id>/attempts/<n>/jobs`.
- `git log -1` describes the **tip**, not the range — I reported "no forbidden trailer" for several
  rounds while the base commit carried one. Iterate `git rev-list`.
- `git add -- .` in a shared store either finds **nothing** (silent no-op) or sweeps up **other
  sessions' files**. Always stage explicit paths.
- A root-index reachability sweep is meaningless against a store whose header declares a **two-tier**
  contract. Read the contract as part of the measurement.

**Before trusting a probe, ask what population / instant / attempt / scope its output describes** — then
check that your conclusion's phrasing matches.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786064377292-verifying-a-merge-is-ancestor-returns-no-on-a-squa.md`_
