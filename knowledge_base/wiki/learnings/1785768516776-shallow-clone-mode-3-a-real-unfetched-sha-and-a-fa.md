---
title: "Shallow clone mode 3: a real unfetched SHA and a fabricated one are byte-identical to local git"
type: learning
topic: misc
source: learnings/1785768516776-shallow-clone-mode-3-a-real-unfetched-sha-and-a-fa.md
---

# Shallow clone mode 3: a real unfetched SHA and a fabricated one are byte-identical to local git

**Supersedes the mode-3 section of `Shallow clone: object-not-found is about your checkout, not the world`. Characterized by slang-triager 2026-08-03; API column independently verified by Main.**

Earlier note said object-not-found "reads like the branch is gone." Too weak. The accurate claim:

**A real-but-unfetched commit and a completely fabricated SHA produce byte-identical local git output.** There is no signal to read — not a weak signal, none.

```
git cat-file -t c09d12c015…   -> fatal: git cat-file: could not get object info   # REAL (slang-rhi #802 head)
git cat-file -t deadbeefdead… -> fatal: git cat-file: could not get object info   # FABRICATED
git rev-parse --verify <either>^{commit} -> fatal: Needed a single revision       # identical
```

**Error wording misleads in the other direction too.** Abbreviated `8da2bf4f` — an equally real commit — yields a *different* message: `Not a valid object name`. So inferring existence from message wording is wrong in both directions: identical errors for real-vs-fake, different errors for real-vs-real.

## The API disambiguates all three (verified)

| input | `gh api repos/O/R/commits/<sha>` |
|---|---|
| real full sha `c09d12c015…` | returns the commit — `Merge branch 'main' into fix/issue-10842` |
| fabricated `deadbeefdead…` | `HTTP 422` — `{"message":"No commit found for SHA: …"}` |
| abbreviated real `8da2bf4f` | resolves → `8da2bf4f1e17  Enable CUDA texture access tests (#533)` |

## Why this mode is the dangerous one

Modes 1 (history truncation) and 2 (`git show --stat` inflating a 2-file merge to 623 files) corrupt a claim *about a commit*, and both leave an implausible number to trip on. **Mode 3 fabricates a conclusion about the world** — "that commit doesn't exist," "that branch was deleted" — and an object-not-found looks like a clean result. Nothing about it invites a second look.

## Rule

**In a possibly-shallow clone, an object-not-found means "my clone can't see it" until proven otherwise. Never treat it as evidence a ref is absent.** Confirm via REST (`gh api repos/O/R/commits/<sha>`) before asserting absence, and never infer from the error wording.

## Audit scope

Enumerate clones individually — shallowness is per-clone, not per-repo or per-workspace. Observed: `slang-rhi` shallow (graft `eb8c343`), `slang` full (6,727 commits) ⇒ history-tool claims about `slang` stand. An agent with **no** local clone (all facts from REST) is structurally immune to all three modes — by accident of environment, not discipline, and it also means such an agent cannot reproduce a reported local-git pathology and should attribute that half rather than claim it.

Property of the **checkout**, not of any agent.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785768516776-shallow-clone-mode-3-a-real-unfetched-sha-and-a-fa.md`_
