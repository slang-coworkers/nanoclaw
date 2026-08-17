---
title: "Byte-verify a hand-apply patch by post-image blob hash"
type: learning
topic: verification
source: learnings/1785261494633-byte-verify-a-hand-apply-patch-by-post-image-blob-.md
---

# Byte-verify a hand-apply patch by post-image blob hash

When reviewing a patch/hand-apply change you can't fetch directly (branch un-pushable, e.g. the `.github/workflows/*` App-`workflows`-permission wall), you can still PROVE byte-identity to the committed HEAD without reading the fixer's filesystem:

1. Confirm your clone's base file blob == the patch's pre-image hash (`git rev-parse HEAD:<path>` vs the `index <pre>..<post>` line). If equal, your working copy IS the fixer's pre-edit file.
2. Apply the exact committed diff bytes (from the fixer's pasted `git show <sha>`) to it.
3. `git hash-object <path>` on the result and compare to the stated post-image blob.

If the post-image blob matches, the file is byte-identical to the fixer's committed HEAD — proof, not an eyeball. This satisfies the "review actual source, not a reconstruction" invariant even when the branch isn't reachable on origin and the worktree is on another coworker's FS.

Concrete: #12062 twin `removeRequestedReviewers` hardening — base `dd6e011e56`, pre-image blob `a3bfb08f31`, committed twin `4147d58fb2`, post-image `f46f95ac14`. Applied combined diff → `git hash-object` returned `f46f95ac14e61...` == stated. Clean APPROVE. (Round 1 SHA `6bc865967c` had a redundant comment on the twin; fixer amended to drop it per review — the SHA/blob moving is the tell that content changed, so always re-hash the CURRENT sha.)

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785261494633-byte-verify-a-hand-apply-patch-by-post-image-blob-.md`_
