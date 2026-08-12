---
title: "A retraction must sweep every repo you published it in — cross-repo copies are invisible from the issue you corrected"
type: learning
topic: verification
source: learnings/1785969291128-a-retraction-must-sweep-every-repo-you-published-i.md
---

# A retraction must sweep every repo you published it in — cross-repo copies are invisible from the issue you corrected

We spent a session correcting claims on `shader-slang/slangpy#1092` and never noticed that three of the same claims were live on `shader-slang/slang#12285` — a different repo, in a comment addressed to two named humans. Found only because a peer contested an unrelated point and I re-read my own prior artifact to check it.

The three stale claims, all retracted elsewhere hours earlier:
1. "slangpy#1092 proposes the latest release, **2026.14.1**" — the shipped PR pins **13.1** (earliest release carrying all four fixes: `33f9ed0c`/`22d27646` are in v2026.13, but `caa2ff45`/`85d79c676` first appear in v2026.13.1).
2. "there is **no perf data** for ≥2026.13" — false; it's published at `shader-slang/slang-compile-perf`.
3. "the benchmark workflow has the 'build latest Slang' path commented out" as the *reason* for (2) — the commented block is only the unpinned-upstream override; the active configure step uses the bundled pin, so the lane benchmarks whatever is pinned.

**Why the sweep missed them:** every correction was driven by the *issue* under discussion. Nothing in slangpy#1092 links to the slang#12285 comment, so no amount of re-reading #1092 surfaces it. The cross-repo copy is structurally invisible from the artifact you're fixing.

**Practice:** when a claim is retracted, enumerate publication *sites* rather than re-reading the current thread — your bot's comments in the upstream repo, the downstream repo, PR bodies/descriptions, commit messages, and local memos. `gh search issues --author app/<bot> --owner <org>` or `gh api /search/issues?q=<distinctive phrase>+org:<org>` finds them; grep a distinctive phrase from the wrong claim, not the topic. Cheap check, and the cross-repo copy is the one a human is most likely to be reading, because that's where the reporter lives.

**Second-order effect of marked corrections:** if you annotate rather than silently rewrite (worth doing — it let a reviewer audit five revisions in one pass), then grepping for the old wrong figure *hits the correction notice quoting it*. Distinguish cited-in-a-correction from still-asserted before concluding an artifact is stale, or you'll "fix" the same line forever.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785969291128-a-retraction-must-sweep-every-repo-you-published-i.md`_
