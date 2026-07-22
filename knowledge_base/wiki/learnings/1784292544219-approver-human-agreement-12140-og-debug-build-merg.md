---
title: "[approver/human-agreement] #12140 -Og debug-build MERGED at decided head — subtractive-guard + no-C++ future-proofing-gap clear VINDICATED"
type: learning
topic: ci-tooling
source: learnings/1784292544219-approver-human-agreement-12140-og-debug-build-merg.md
---

# [approver/human-agreement] #12140 -Og debug-build MERGED at decided head — subtractive-guard + no-C++ future-proofing-gap clear VINDICATED

**Outcome:** shader-slang/slang#12140 ("Use `-Og` for GCC/Clang debug builds", skiminki-nv) MERGED 2026-07-17T12:47:08Z at exactly my recorded decision head `f5b280ec73750e0ee5962cd697f2dd077e0bf049`. My shadow decision was WOULD_APPROVE (CLEAN). human_verdict=APPROVED recorded ⇒ **clean agreement, VINDICATED.**

**Confirmation it's genuine agreement (not a self-merge false-positive):** merged_by=skiminki-nv (the author), BUT maintainer jvepsalainen-nv APPROVED at the exact head `f5b280ec` (11:29:20Z) BEFORE the merge. Contrast the #12129 self-merge/latestReviews=[] → NO_HUMAN_REVIEW class: an author-triggered merge is still real agreement when an independent maintainer approved the same head first. The merge commit `d9c9fa41` is a squash (single parent, msg "…(#12140)") and master post-merge carries the exact `AND NOT MSVC` guard + `$<$<CONFIG:Debug>:-Og>` line I scored — merged content == decided content.

**The transferable calibration (what this confirms was safe to clear):**
- A **subtractive guard** added to a build-flag application, relative to a prior CLEAN head, is safe to WOULD_APPROVE without re-deriving from scratch: `AND NOT MSVC` can only *remove* `-Og` from clang-cl, never add it → cannot regress prior-green. The maintainer agreed.
- A `-Wmaybe-uninitialized`/`-Werror` **coverage gap** on a pure-cmake build-flag PR (adds zero C++) is safe to clear as pure future-proofing when CI is terminal-green including default warnings-as-errors legs. The human shipped it with the gap unaddressed — confirming it was a real reviewer *note*, not a blocker, exactly the withhold-vs-clear call the conservative-lean bar is meant to get right (here: CLEAR was correct).

**Process note (join discipline):** verified merged head vs recorded head via REST timeline BEFORE scoring (per [[pr-12117-decided]] anchor) — the `merged` event's commit_id is the master squash commit, NOT a new PR head; the PR head at merge was still f5b280ec (last `committed` event). Don't mistake the merge-commit SHA for a superseding revision.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784292544219-approver-human-agreement-12140-og-debug-build-merg.md`_
