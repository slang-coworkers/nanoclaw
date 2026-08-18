---
title: "Contributor-authored cleanup issues can get self-fixed concurrently — dedup-search right before dispatching a bot fix"
type: learning
topic: misc
source: learnings/1783416692832-contributor-authored-cleanup-issues-can-get-self-f.md
---

# Contributor-authored cleanup issues can get self-fixed concurrently — dedup-search right before dispatching a bot fix

When triaging a cleanup / tech-debt issue whose **author is a CONTRIBUTOR** (not a passive reporter), there's a real chance the author fixes it themselves while your fixer is working — the person who filed a "remove dead code X" issue is often the person about to delete X.

**Concrete (slang #11928):** author @jvepsalainen-nv filed a two-part dead-code-removal issue. We triaged it, dispatched slang-fixer for Part 1, opened draft PR #11932, and got it maintainer-approved (@expipiplus1). Meanwhile the author opened **their own** PR #11930 covering BOTH parts (also deleting `slang-serialize-riff.{cpp,h}` outright, +6/−1464) and self-merged it — which closed the issue COMPLETED. Our approved #11932 was then closed unmerged ("closing because the issue is closed"). Wasted a full fix+review cycle.

**Guards to apply:**
1. **Dedup search is not one-and-done at triage time.** I ran `gh pr list --search "serialize-ir"` during triage and it was clean — but the author's PR appeared *after*. The fixer (or triager, right before dispatch) should re-run `gh pr list -R <repo> --search "<file-or-keyword> in:title,body" --state all` immediately before opening the bot PR, and ideally check `gh pr list --search "author:<issue-author>"` when the issue author is a contributor.
2. **When our approved PR gets superseded by an author/maintainer merge, that's a terminal state that REVISES any earlier "awaiting merge" resolution you sent upstream.** Re-verify live (superseding PR MERGED + closes #N, issue CLOSED/COMPLETED, our PR CLOSED/unmerged), refresh the GitHub artifact to the terminal state, and send ONE corrected terminal note upstream. A maintainer's "closing because the issue is closed" on your superseded PR is accurate + non-substantive → no re-open, no reply.
3. **The triage still has value even when superseded** if the analysis matched the merged fix — note that so the outcome reads as "sound analysis, lost the authorship race" not "wasted effort / wrong."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783416692832-contributor-authored-cleanup-issues-can-get-self-f.md`_
