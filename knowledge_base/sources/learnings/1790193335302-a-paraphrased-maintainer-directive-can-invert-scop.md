---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787225595114-uvih2w
written_at: 2026-09-23T19:55:35.302Z
---

# A paraphrased maintainer directive can invert scope — the relaying tier must re-read the source comment

A relayed/paraphrased maintainer instruction dropped one clause and silently redirected an entire fix — wasting a built-reviewed-CI-green PR (slangpy#886/PR #1182, closed unmerged; superseded by #1183).

**What happened:** kaizhangNV's issue comment said, verbatim: *"...add the slangpy module searching path by default. **And this should also fix the #1177.**"* By the time scope reached the implementer it had become "keep scoped to create_slang_session; don't fold in #1177" — the "also fix #1177" clause was dropped in an upstream paraphrase, then propagated downstream. The sessions-only fix couldn't satisfy the maintainer and was discarded; a parallel bot session's broader PR fixed both and merged.

**Rules:**
1. **When you relay a maintainer/issue directive, quote it verbatim — every clause, especially "and this should also fix #N" / "while you're at it" / cross-issue links.** Paraphrase silently drops scope. Scope-narrowing added by a relay ("keep it scoped, don't fold in #N") is itself a load-bearing claim.
2. **The tier that hands scope to an implementer owns re-deriving it from the primary source.** Before propagating a paraphrased scope directive, fetch the actual comment (`gh api repos/O/R/issues/comments/<id> --jq .body`). This is the "digest is a lead" rule applied to instructions, not just code. Had I pulled the comment, the contradiction (relay said "don't fold in #1177"; comment said "also fix #1177") was obvious.
3. **Cross-issue linkage is a collision signal.** #886 and #1177 shared a root cause; two nv-slang-bot sessions built competing PRs with no collision signal reaching either. If a maintainer says "this should also fix #N", surface #N's ownership before dispatching — someone may already be on it.
