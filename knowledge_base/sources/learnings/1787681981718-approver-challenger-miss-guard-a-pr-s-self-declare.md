---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787679838053-tefesj
written_at: 2026-08-25T18:19:41.718Z
---

# [approver/challenger-miss-guard] A PR's self-declared "land #X first" dependency is a live CI-break until #X is merged AND current master is clean

**Symptom.** slang#12717 added a slang-test guard rejecting absolute `-o` paths, exempting the host's own null sink (`/dev/null` POSIX, `NUL` Windows). Its own PR body stated "#12334 should land first" (that PR converts 3 existing `-o /dev/null` tests to `-o -`), but the PR did NOT absorb those edits or depend on the merge. Devin flagged one 🔴; I decided BLOCK.

**Root cause of the hazard.** The exemption is host-specific: on Windows `/dev/null` starts with `/` ⇒ classified absolute ⇒ rejected (only `NUL` is exempt there). Current master still had 3 standard-suite files using `-o /dev/null` (`tests/reflection/ir-type-alignment-attr.slang`, `…-existential.slang`, `tests/autodiff/func-extension/subscript-accessor.slang`) that run in **every-PR CI including the Windows leg**. So merging before #12334 fails those 3 on Windows. Codex OUTPUT_REVIEW confirmed 3 failed Windows `test-slang` jobs already on the head, naming exactly those tests. Human reviewer (jkwak-work, MEMBER, the feature requester) independently flagged the same on the head.

**The transferable probe — for ANY PR that names a sequencing dependency in its body/title, or introduces a new rejection/guard over inputs that already exist in the tree:**
1. Grep CURRENT master (not the stale local clone, not history) for the inputs the new guard would now reject — `gh api search/code` or a fresh worktree at master head. If any exist, the guard breaks them.
2. Check the named dependency PR's LIVE merge state (`gh pr view <dep> --json state,mergedAt`). "Should land first" + dependency still OPEN + affected inputs still present on master = a reproducible CI break at merge time = BLOCK, not ABSTAIN.
3. Scope the blast radius to the CI matrix: a host-specific exemption (`/dev/null` vs `NUL`) breaks only the OTHER host's leg — confirm that leg is in every-PR CI (Windows is), not just nightly (the ~1000 `docs/generated/tests` `/dev/null` directives are Linux-only nightly, so they were NOT part of the break).

**Why BLOCK not ABSTAIN(OPEN_GAP).** This is not "a human should look" — it's a verified, reproducible failure at the current master state, corroborated by three independent signals (Devin 🔴, failed Windows jobs on the head, the human reviewer). A self-acknowledged-but-unsatisfied dependency is a real defect, not advisory. Resolves the moment #12334 merges or the PR absorbs its edits.

**Note on the stale local clone.** `/workspace/agent/slang` was pinned at July-15; the reviewer's "pre-existing absolute-path cases" claim could only be settled against LIVE GitHub state (code-search on master head + the dependency PR's live state). A grep of the stale clone alone would have under-counted or missed the affected files.
