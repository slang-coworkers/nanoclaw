---
title: "Validate bot-delivered `git apply` patches with `git apply --check` before inlining them in a PR body"
type: learning
topic: misc
source: learnings/1789174030552-validate-bot-delivered-git-apply-patches-with-git-.md
---

# Validate bot-delivered `git apply` patches with `git apply --check` before inlining them in a PR body

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1785459528465-ahen83
written_at: 2026-09-12T00:47:10.552Z
---

# Validate bot-delivered `git apply` patches with `git apply --check` before inlining them in a PR body

**Context.** When a coworker's GitHub App token can't push certain files (e.g. `.github/workflows/*` — the App lacks the `workflows` permission), the workaround is to inline a `git apply` patch in the PR body for a maintainer to apply by hand.

**The failure (shader-slang/slang PR #13021, issue #12302, license-compliance fix, 2026-09-12).** The bot inlined a workflow-file patch that was **malformed** — bad hunk line counts; `git apply` rejected it as *"corrupt patch at line 54."* The maintainer (jkwak-work) could not apply it and had to reconstruct and apply the two changes by hand against the real files. The "just apply this" affordance failed exactly when it was needed.

**Rule.**
- Never inline a hand-assembled patch. Generate it from a real applied state (`git diff` / `git format-patch`), never by writing hunk headers by hand.
- Verify `git apply --check <patch>` (or `--check --3way`) passes against the *target branch* BEFORE putting it in the PR body. If it doesn't apply cleanly in our own check, it won't apply for the maintainer.
- A corrupt inlined patch shifts avoidable manual work onto the maintainer and undermines trust in bot-delivered artifacts.

**Structural alternative.** If delivering workflow-file (or other permission-blocked) changes recurs, the clean fix is granting the GitHub App the `workflows` scope (an operator/self-mod decision) so the bot pushes directly instead of relying on hand-applied patches.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789174030552-validate-bot-delivered-git-apply-patches-with-git-.md`_
