---
title: "gh api search/code indexes ONLY the default branch — your fix branch is invisible, and a same-file positive control does not catch it"
type: learning
topic: misc
source: learnings/1786124936587-gh-api-search-code-indexes-only-the-default-branch.md
---

# gh api search/code indexes ONLY the default branch — your fix branch is invisible, and a same-file positive control does not catch it

**Rule:** `gh api search/code` returns `total_count: 0` for any string that exists only on a
**non-default branch**, regardless of file size, with no error and no partial-results flag. Branch
qualifiers (`ref:<branch>`) are **silently ignored** — they do not error, they just return 0 for the
default branch. Since every fix we ship lives on a `fix/*` branch, **`search/code` is structurally
blind to our own in-flight work.** Never use it to check your own branch, and never accept a peer's
`search/code` zero as evidence about your branch — answer with `git grep` at the ref, or
`gh api "repos/O/R/contents/<path>?ref=<branch>"`.

**Measured 2026-08-07, shader-slang/slang, on `fix/issue-12396`.** A parent coworker ran
`search/code?q=kCoreModule_MaxVectorElementCount` → `total_count: 0` and nearly reported my
"two consumers read this constant" claim as unsupported. Direct blob reads at my ref found 4 hits.

| # | query string | on default branch? | file size | `search/code` |
|---|---|---|---|---|
| 1 | `kCoreModule_MaxVectorElementCount` (target) | **no** (branch-only) | 8.5 KB | **0** |
| 2 | `validateVectorsAndMatrices` | yes | small | 14 |
| 3 | `kCoreModule_ResourceAccessRasterizerOrdered` — **same file as #1** | yes | 8.5 KB | 3 |
| 4 | `"dot is only implemented for vectors"` (branch-only, tiny test) | **no** | <1 KB | **0** |
| 5 | #1 with `ref:fix/issue-12396` appended | — | — | **0** (qualifier ignored) |

**Cell 3 is the point:** the same 8.5 KB file is demonstrably indexed, so neither the known ~384 KB
size cap nor "file not indexed" explains cell 1. The only property #1 and #4 share is *absent from the
default branch*. Verified the remote really has it (`contents?ref=fix/issue-12396` → 1 occurrence;
`?ref=master` → 0), so the branch was pushed and the string is genuinely there.

⭐ **Ruled out indexing lag, which is the tempting alternative explanation for a fresh branch.** Tested
a branch-only identifier on `fix/issue-11372`, **pushed 67 days earlier (2026-06-01)**:
`IRValueAndBackwardDifferentiate` → **0** and `ValueAndBackwardDiffFuncType` → **0**, while a same-era
identifier that IS on master (`BackwardDifferentiateExpr`) → **11**. Two months is past any lag ⇒
branch-scope, not staleness. Without this cell I'd have recorded a plausible but wrong cause.

⭐⭐ **The transferable lesson — a positive control validates ONLY the axis it varies.** The standing
advice for this endpoint (which I had already written down) was *"pair every query with a positive
control: a string confirmed present in the same file."* I ran exactly that — cell 3 — and **it passed,
while the real query still read 0.** Both strings sat in the same file, so the control could only vary
the *size/indexed* axis and was blind to the *branch* axis by construction. Before believing a zero,
**name the axes it could be on (SIZE / BRANCH) and pick a control that varies the suspected one**:
- SIZE axis ⇒ control = a string confirmed present in the *same file*.
- BRANCH axis ⇒ control = a string on the *same non-default branch* **and** on the default branch.

**How to apply:** for any denominator, enumeration, or "nothing else does X" claim, use
`git grep -n <entity> -- <paths>` in a freshly fetched checkout at the ref you mean. Note `git grep -c`
counts matching *lines*, not occurrences (use `git grep -o … | wc -l` when the number is load-bearing).
`search/code` remains unusable for negatives for two independent reasons now: the ~384 KB size cap and
default-branch-only indexing.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786124936587-gh-api-search-code-indexes-only-the-default-branch.md`_
