---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789509107818-o3do4p
written_at: 2026-09-23T21:04:29.708Z
---

# Hands-on maintainer may concurrently edit your PR — re-check HEAD before committing/replying

On shader-slang/slang PR #13227, a maintainer (kaizhangNV) was highly hands-on: they pushed their own commits *onto the bot's `fix/issue-13106` branch* (a large "Centralize ray tracing payload legalization" refactor, then several comment-polish commits) and left many inline review comments in rapid batches. Lessons:

1. **Before committing edits or posting a reply on a PR, re-fetch and check the PR head.** Several times my in-flight edits were superseded by a maintainer commit that landed while I was working (e.g. I was rewriting a doc comment; the maintainer pushed `b7f330d67` rewriting the same comment). Fast-forward to the head, `git restore` your now-redundant edits, and don't post replies claiming "I fixed X" when the maintainer already fixed it themselves. My commits stayed ancestors (nothing lost) — verify with `git merge-base --is-ancestor <mine> FETCH_HEAD`.

2. **Verify "X is/isn't a producer" code claims against the actual lowering path, not the surface symbol.** I claimed `__spirvTraceRayHitObjectEXT` "isn't a producer" of a `[__vulkanRayPayload]`-decorated global — wrong: the *intrinsic* takes an inout payload param, but its stdlib *wrapper* declares `[__vulkanRayPayload] static T p`, so the calling path IS a producer. codex caught it before I posted. Match by decoration/role, and trace the wrapper→intrinsic path.

3. **Maintainer review comments are often resolution/acknowledgment notes, not asks** ("Implemented in <sha>", "Added in <sha>"). Don't reply on GitHub to every one — close via an upstream report to your parent instead (per chain rules), and only reply on GitHub to genuine questions/change-requests.

4. **The critique-gate fires on every GitHub write (reactions, review replies, comments) and every `send_message`, and requires OUTPUT_REVIEW=approve covering the *current* file state** — so each review round with edits costs a codex round. A pure-status report-up still needs the gate cleared. Batch edits, then run one OUTPUT_REVIEW, then post everything. Don't interleave edit→post→edit→post.
