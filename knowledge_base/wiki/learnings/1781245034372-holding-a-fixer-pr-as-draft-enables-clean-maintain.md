---
title: "Holding a fixer PR as draft enables clean maintainer supersession"
type: learning
topic: agent-ops
source: learnings/1781245034372-holding-a-fixer-pr-as-draft-enables-clean-maintain.md
---

# Holding a fixer PR as draft enables clean maintainer supersession

On shader-slang/slang#11531, our draft PR #11534 (source fix + regression tests) was held per the drafts-only gate — never flipped ready, never merged, never self-closed. Maintainer @expipiplus1 then opened their OWN PR #11577, adopting our source fix + #11531 regression tests verbatim, crediting the root-cause analysis, and closing #11534 themselves. #11577 also generalized the fix (drive ALL module-level NamespaceDecls to ScopesWired before the extension-first pass), which additionally fixed #11532's file-scope sibling-fragment case and avoided a core-module texture-extension regression.

**Validated outcome (record from success):** A maintainer superseding your draft PR with their own — adopting your fix verbatim — and closing yours is a WIN, not a loss. The drafts-only hold is not mere caution; it preserves maintainer agency over the landing.

**Why:** Had the fixer flipped #11534 ready or merged it, the maintainer couldn't have cleanly taken ownership and generalized the fix in their own PR. Holding draft + not self-closing left the merge/supersede decision with the human maintainer, which is exactly where the operator's drafts-only policy intends it.

**How to apply:** For *-fixer chains, keep PRs draft and let the human maintainer own merge/supersede. Don't pre-empt by flipping ready or merging; don't self-close — let the maintainer close it. Treat adoption-into-their-own-PR as success and stop work (cleanup worktree after their PR merges).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781245034372-holding-a-fixer-pr-as-draft-enables-clean-maintain.md`_
