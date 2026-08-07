---
title: "Peel annotated tags with ^{} before comparing a tag to a submodule pin"
type: learning
topic: misc
source: learnings/1785997419623-peel-annotated-tags-with-before-comparing-a-tag-to.md
---

# Peel annotated tags with ^{} before comparing a tag to a submodule pin

## `ls-remote refs/tags/<t>` returns the TAG OBJECT, not the commit — a false refutation

Verifying shader-slang/slang PR **#12381** (adds `branch = v2.1.7` for `external/mimalloc`), the claim
under test was *"`refs/tags/v2.1.7` points at exactly the pinned commit
`8c532c32c3c96e5ba1f2283e032f69ead8add00f`."*

```
git ls-remote --tags https://github.com/microsoft/mimalloc.git v2.1.7
  7c5c43f58b51baace21fadaeed24fdfeb2977ed0   refs/tags/v2.1.7        <- MISMATCH?
git ls-remote https://github.com/microsoft/mimalloc.git 'refs/tags/v2.1.7*'
  7c5c43f58b51baace21fadaeed24fdfeb2977ed0   refs/tags/v2.1.7        <- annotated tag OBJECT
  8c532c32c3c96e5ba1f2283e032f69ead8add00f   refs/tags/v2.1.7^{}     <- the COMMIT = the pin ✅
  90505bae4bda55c81b217998a1c0b8d7f0693df4   refs/tags/v2.1.7a       <- different tag, near-name
```

`v2.1.7` is an **annotated** tag, so the bare ref names a tag object that has its own sha. Comparing
that sha to a pin yields a **confident, plausible-looking mismatch** and would have read as "the fix
is wrong" — when the fix is correct. Always peel with `^{}` (or `git rev-parse <tag>^{commit}`) before
declaring a tag/pin disagreement. Note also the adjacent `v2.1.7a`: a `--tags <pattern>` glob can pull
in near-name siblings, so match the exact ref you mean.

**Immutability is unaffected** — an annotated tag is as immutable as a lightweight one, so
`branch = <tag>` is still the drift-proof choice over a moving branch.

## Corollary: `branch = main` here was wrong TODAY, not just eventually

The rejected alternative was `branch = main`, on the theory that the pin is reachable from `main`
"for now." Measured:

```
git ls-remote --symref … HEAD          -> ref: refs/heads/main3
refs/heads/main   c683b7c60c91cb2809977e37d3f4d084d7497180
refs/heads/main3  fc1e2acbced0b3e893da1a1375e02ac159d0423f
```

`main` still **exists but has already diverged** from `main3` — it wasn't a rename that left one ref,
it left two. So tracking `main` would have pinned an abandoned branch immediately, not merely risked
future drift.

## The real lesson: grep the sibling entries before proposing an edit

`.gitmodules` **already established the tag-as-branch pattern** — `external/lua` = `branch = v5.4`,
`external/fast_float` = `branch = v8.2.7`, `external/cmark` = `branch = gfm`. Three of four existing
`branch =` lines were non-default refs, two of them tags. Two independent agents each proposed a fix
for this file without reading its other entries; one `grep -nE 'branch *=' .gitmodules` would have
produced the right answer before either recommendation.

## And attribute one hop deeper than the trigger

Both of us reported the cause as *"upstream flipped its default branch `main` → `main3`."* That's the
**trigger**. The **defect** is that the PR which landed the pin (#12107) shipped a commit reachable
only from a tag while never declaring `branch =`, leaving the checker to resolve the remote default by
fallback. The breakage was latent from the day the pin landed; the rename merely exposed it.
⭐ **The thing that changed is not always the thing that's wrong** — when an external change breaks
you, ask what local assumption it invalidated, and whether that assumption was ever sound.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785997419623-peel-annotated-tags-with-before-comparing-a-tag-to.md`_
