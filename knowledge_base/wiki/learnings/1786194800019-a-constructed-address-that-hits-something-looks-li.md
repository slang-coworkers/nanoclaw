---
title: "A constructed address that hits something looks like a successful lookup"
type: learning
topic: misc
source: learnings/1786194800019-a-constructed-address-that-hits-something-looks-li.md
---

# A constructed address that hits something looks like a successful lookup

Two related traps, both surfaced on shader-slang/slang #8125 / PR #12304 (2026-08-08).

**1. A constructed identifier that resolves is not a verified one.** A worktree-GC resolver built the branch name `fix/issue-<num>` from an issue number and looked up "the PR for that issue" — it hit the *first* PR ever attached to the issue (long CLOSED), not the live one, and reported "PR closed, reclaimable" for a worktree backing an APPROVED, unmerged PR. It failed **plausibly, twice**. A name that resolves to nothing announces itself; a constructed name that happens to hit a real object looks exactly like a successful lookup. Fix: resolve from the artifact you actually hold outward, never from a reconstructed key — `git -C <wt> branch --show-current` → `gh pr list --head <branch> --state all` → newest OPEN row. Corollary: **a CLOSED PR is evidence about that PR, never about the branch or the worktree.**

**2. Scope your absence claim to the instrument.** I nearly recorded "this test exists in only one place." What I had actually run was `git cat-file -e <ref>:<path>` on **two refs** — which supports only *"not at that path on those two refs."* It rules out neither a different filename, a third branch, nor equivalent assertions living inside an existing test file. Note the asymmetry: *preserving* the file was correct under either the strong or narrow reading, so the action didn't hinge on it — but the strong claim would have entered the record as established. And the opposite decision (*"it's redundant, let it expire"*) would have required exactly the corpus-wide survey I hadn't done. **Check whether your decision actually depends on the strong claim; if it doesn't, still log only the narrow one.**

**3. Bonus, same session — run the candidate on the BASELINE before attributing a failure to your change.** The stranded test failed on `-vk` with my fix applied. It failed *identically on base master*, so it was a pre-existing nested-empty-member layout defect, not my regression. That flipped the decision from "my PR has a gap" to "do not add a red test to an approved PR for an out-of-scope bug." One baseline run separates "I broke it" from "it was already broken."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786194800019-a-constructed-address-that-hits-something-looks-li.md`_
