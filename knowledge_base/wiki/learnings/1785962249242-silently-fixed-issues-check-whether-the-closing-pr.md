---
title: "Silently-fixed issues: check whether the closing PR ever named the issue"
type: learning
topic: misc
source: learnings/1785962249242-silently-fixed-issues-check-whether-the-closing-pr.md
---

# Silently-fixed issues: check whether the closing PR ever named the issue

Scrubbing 7 stale slangpy issues (2026-08-05), **two were fixed months ago and stayed open purely because the closing PR didn't reference them.** This is common enough to check first, before any "is it still broken?" analysis.

- **#510** (DiffTensorView parity) — the named gap (`loadOnce`/`loadUniform`) was closed by PR #910 on 2026-04-02. That PR declared `Fixes #570` and `Fixes #769`, never #510.
- **#779** (dispatches > 65536*32) — implemented exactly as the issue body proposed by PR #995 on 2026-05-26. **PR #995's description is empty** and its commit message carries no issue reference, so nothing linked back.

**Cheap first move on any stale issue:** `git log -S "<distinctive identifier from the issue>" --oneline -- <likely file>` finds the implementing commit even when no PR/issue metadata connects them. Then `gh pr view <n> --json body` to confirm the omission. Absence of a timeline cross-reference is *not* evidence the work didn't happen.

**Two traps that nearly produced false negatives:**

1. **Naming-convention mismatch.** #510's gap was discussed as `loadOnce`/`loadUniform` (camelCase, matching `DiffTensorView`), but slangpy's shipped Slang library uses **snake_case** — `load_once`, `load_uniform` in `slangpy/slang/difftensor.slang`. Grepping the camelCase names across `slangpy/slang/` returns **zero hits** and reads as "not implemented." Search both spellings before concluding absence. Generalization: when an API is discussed in one convention and implemented in another, a name grep is a *convention* test, not an existence test.

2. **A user-space workaround file is evidence the library lacks the feature.** `slangpy/benchmarks/ppisp/extensions.slang` hand-rolls `loadVecUniform`/`loadVecOnce`/`storeVecOnce` as extension methods. A benchmark carrying its own extension file to reach parity means the library doesn't ship those — which is how I scoped #510's *residual* gap (vec-valued and store-side variants still missing) after finding the scalar half done.

**Also:** verify "co-authored" before writing it. I claimed a reviewer co-authored PR #910; `git log --format=%B` showed **no** `Co-authored-by` trailer — he was a reviewer. `gh pr view <n> --json reviews` distinguishes the two. See [[a-pr-number-in-a-commit-subject-is-untrusted]] — a `(#N)` in a merge-commit subject may be an upstream repo's number, not this repo's (slangpy commit `842f6a93` says `(#263)` but slangpy#263 is an unrelated PR touching 0 of those files); cite the commit hash and date instead.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785962249242-silently-fixed-issues-check-whether-the-closing-pr.md`_
