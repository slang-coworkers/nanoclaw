---
title: "A squash-only repo cannot auto-close a subsumed PR: check merge settings before calling closure contingent"
type: learning
topic: misc
source: learnings/1786044919627-a-squash-only-repo-cannot-auto-close-a-subsumed-pr.md
---

# A squash-only repo cannot auto-close a subsumed PR: check merge settings before calling closure contingent

When PR B contains PR A's commits whole (`compare/A...B` ⇒ `status=ahead, behind_by=0`), it is tempting to say A's `Fixes #N` will still fire once B merges, because A's head becomes reachable from master. **In a squash-only repo it never does, and the closure is structurally blocked rather than merely uncertain.**

Measured on shader-slang/slang (2026-08-06):

- `gh api repos/O/R --jq '"squash=\(.allow_squash_merge) mergecommit=\(.allow_merge_commit) rebase=\(.allow_rebase_merge)"'` ⇒ `squash=true mergecommit=false rebase=false`. One API call decides it.
- A squash merge mints a **new single-parent** commit, so the branch tip is never an ancestor. Census of 20 recently-merged PRs: `parents=1` on **20/20** merge commits.
- Ancestry census, 25 merged PRs: `gh api repos/O/R/compare/master...<head> --jq .status` ⇒ `diverged` on **25/25**, zero ancestors. Must-hit control: `compare/master...master` ⇒ `identical`, so an "ancestor" reading was reachable and the zero is real.
- Historical precedent of the same shape: superseded drafts closed with `merged=false`, `merged_at=null` — closed by hand, never auto-closed-as-merged.

⇒ If B has `closingIssuesReferences = []`, merging B leaves every issue open **and** leaves A an open draft whose content already shipped. Adding an explicit `Fixes #N` to B's body is not the tidier option, it is the only thing that closes them.

**The transferable part is about how the claim is phrased.** "Closure is contingent on a mechanism I did not measure" and "closure is structurally impossible" produce the *same* next action from a careful reader, so the difference looks cosmetic — but only the second tells you the recommendation is **mandatory** rather than belt-and-braces, and only the second predicts that A also needs a manual close. An unmeasured mechanism is worth one API call before it is handed downstream as a caveat; a hedge that survives the hop gets read as "probably fine".

Related trap: `git merge-base --is-ancestor <head> master` returning NO after a squash merge is **not** evidence the fix did not land — check merged file *content* and the merge commit's parent count instead.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786044919627-a-squash-only-repo-cannot-auto-close-a-subsumed-pr.md`_
