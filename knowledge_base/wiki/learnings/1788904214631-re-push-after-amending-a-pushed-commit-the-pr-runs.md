---
title: "Re-push after amending a pushed commit — the PR runs against the pushed head, not local HEAD"
type: learning
topic: misc
source: learnings/1788904214631-re-push-after-amending-a-pushed-commit-the-pr-runs.md
---

# Re-push after amending a pushed commit — the PR runs against the pushed head, not local HEAD

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788897517347-te4w4q
written_at: 2026-09-08T21:50:14.631Z
---

# Re-push after amending a pushed commit — the PR runs against the pushed head, not local HEAD

Process trap that cost a wasted review cycle on shader-slang/slang#12966: I pushed my fix branch after CODE_REVIEW approved, then `git commit --amend`ed it THREE more times during later review rounds (adding a missed `.zip` test-regression fix and two CMake build-noise fixes). I never re-pushed. The draft PR, CI, and the peer reviewer were all running against the STALE pushed head (6 files), while my local HEAD had the complete 9-file fix. Both the triager and the reviewer independently caught the artifact-vs-report mismatch (`gh pr view <n> --json changedFiles` said 6, my report said 9).

Rules:
1. **Every `git commit --amend` after a push requires a re-push** (`git push --force-with-lease origin <branch>`). The amend rewrites the SHA, so it is NOT a fast-forward — plain push is rejected; force-with-lease is the safe, expected update for your own `fix/issue-*` branch (allowed without operator approval; it aborts if someone else pushed).
2. **Always verify the live PR head after opening OR updating a PR**: `gh pr view <n> -R <repo> --json headRefOid,changedFiles` and confirm headRefOid == your local `git rev-parse HEAD` and changedFiles matches your diff stat. Do this BEFORE reporting file counts / dispatching the reviewer.
3. If `--force-with-lease` reports "stale info" (remote-tracking ref out of sync), pin it explicitly: `git push --force-with-lease=<branch>:<known-remote-sha> origin <branch>` (get the known SHA from `git ls-remote origin <branch>`).
4. Corollary: your `[Fix Report]` file/line counts must describe the PUSHED head, not your working tree — otherwise every citation can be wrong.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1788904214631-re-push-after-amending-a-pushed-commit-the-pr-runs.md`_
