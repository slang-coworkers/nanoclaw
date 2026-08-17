---
title: "Disputing a line citation on a branch you don't have: ask if the line is in their DIFF, not in your tree"
type: learning
topic: ci-tooling
source: learnings/1785858067716-disputing-a-line-citation-on-a-branch-you-don-t-ha.md
---

# Disputing a line citation on a branch you don't have: ask if the line is in their DIFF, not in your tree

**Failure shape:** a reviewer greps their own clone to check a coworker's `file.cpp:NNNN` citation, finds the line absent or showing different code, and concludes the citation is wrong. If the disputed line is one the PR *itself adds*, "does this line exist?" has **different true answers on each side** — and every explanation that assumes a shared corpus (truncated grep, off-by-one reading, stale/shallow clone) fits the evidence.

**Observed 2026-08-04 (shader-slang/slang PR #11709, `slang-lower-to-ir.cpp`):** fixer cited `:3697-3703` as an `HLSLGroupSharedModifier` → `ParamPassingMode::BorrowInOut` override to delete. Supervisor's grep returned exactly **two** sites (`:3314`, `:4765`), no `:3697`, and challenged the citation. Three explanations were proposed across three round-trips — (1) supervisor's grep was truncated, (2) supervisor read one branch past it, (3) supervisor's clone was stale — **all three wrong.** Ground truth: `git diff origin/master...HEAD` showed the branch as **`+` lines the PR adds** (`@@ -3684,6 +3684,23 @@`, 17 lines). Master genuinely has 2 sites at exactly the lines the supervisor reported; the fixer's branch has 3. Both greps were correct *for their own tree*.

**The discriminator (use this FIRST):**
```bash
git diff <base>...<their-branch> -- <file>   # is the disputed line in their diff?
```
If the line is an addition, stop — there is no discrepancy to explain. Only if it is *not* in the diff does whose-tree-is-stale become the right question, and then:
```bash
git cat-file -t <their-sha>    # unresolvable ⇒ their commit is local/unpushed, or your corpus lags
git merge-base --is-ancestor <your-head> origin/master && echo "you are on/behind master"
```

**Two traps that made this hard to see:**
- **A shared anchor line disguises divergence.** `getExplicitlyDeclaredParamPassingMode` opened at `:3673` in *both* trees, which made both parties confident they were reading the same function body. An identical enclosing-symbol line is not evidence of an identical file.
- **Proximity is evidence of authorship.** The disputed line sat *inside the function the PR modifies*. When a contested citation is adjacent to the change under discussion, the likeliest explanation is that the disputing party simply doesn't have it yet.
- An unresolvable SHA is often just **an unpushed local merge commit**, not a stale clone.

**Filing discipline:** don't record a real hazard (e.g. "shallow clones lag") against a case that didn't exhibit it — a misattributed lesson teaches the next reader to distrust a rule that works elsewhere. Withdraw the wrong lesson explicitly when the diagnosis changes.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785858067716-disputing-a-line-citation-on-a-branch-you-don-t-ha.md`_
