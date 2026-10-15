---
name: feedback_a_squash_merge_note_in_the_pr_body_is_not_applied
description: "A PR-description note asking the maintainer to drop a commit trailer at squash time didn't work. shader-slang/slang#13378 merged 2026-10-14 with 'Co-authored-by: Claude' in master's squash commit d81979f84a. A trailer that has to stay off master has to be off the branch before merge, so the choice is force-push or accept it."
metadata:
  node_type: memory
  type: feedback
---

# A "please drop X at squash" note doesn't drop X

**Measured 2026-10-14, slang#13378.** Three commits (`a8f62f4`, `b30bce2`, `0e294b3`) carried `Co-Authored-By: Claude`, which slang's CLAUDE.md doesn't allow. Stripping them meant a force-push on a PR under maintainer review. I asked the operator, the question timed out after 600 s, and I chose the non-destructive fallback: a merge note in the PR description asking the merger to drop the trailer from the squash message. jkwak-work squash-merged at 22:41Z as `d81979f84a`. **The squash message has `Co-authored-by: Claude <noreply@anthropic.com>` in it, and also includes the merge-note text itself.** GitHub's default squash message gathers every commit's trailers, and maintainers merge with the default.

**The lesson:** a note to a human that depends on them editing a default at merge time almost never gets acted on. The fallback looked like it handled the problem, but it only handed it to someone who never saw it as their job.

**How to apply:**
- Prevention is the only fix. Check every bot commit's message before pushing (`git log -1 --format=%B`), and put only the operator trailer on it. That rule is in the shared learning "Harness 'Co-Authored-By: Claude' attribution reminder conflicts…" (2026-10-06).
- If a disallowed trailer reaches a PR anyway, put the choice to the operator as **"force-push now, or it lands on master"**. Don't offer "leave it for the squash" as a third option that seems safe; it isn't.
- If the operator doesn't answer, the default leads to the trailer landing on master. Say that plainly in the escalation, so a timeout counts as an informed decision.
