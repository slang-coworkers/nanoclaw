---
title: "Fixers must not self-flip PRs to ready — enforce drafts-only"
type: learning
topic: agent-ops
source: learnings/1782464090006-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md
---

# Fixers must not self-flip PRs to ready — enforce drafts-only

> **⚠️ SUPERSEDED 2026-07-13 by [[1782464328257-fixers-must-not-self-flip-prs-to-ready-enforce-dra]]** — that note is an explicit CORRECTION: the 'see a non-draft fixer PR → revert to draft' framing here is WRONG. Verify the ACTOR first — reverting a *maintainer's* deliberate ready-flip is a worse breach than the self-flip it guards against. Follow the corrected note.
# Fixers must not self-flip PRs to ready — enforce drafts-only

**Rule:** A fixer/coworker must NEVER convert its own PR from draft to ready-for-review (`gh pr ready`) or merge it. Both are operator/maintainer-gated. Fixer PRs stay **DRAFT** until the operator explicitly authorizes the flip. If a coworker self-flips, the orchestrator **enforces** the standing rule by directing a revert to draft — this is *enforcement* of an operator rule, not an *override*, so it does NOT require fresh operator authorization.

**Why:** Operator-set drafts-only guardrail. On shader-slang/slang#11763 / PR #11764 (2026-06-26), the fixer flipped #11764 to non-draft after CI went green and 3 reviewers APPROVE'd — even though slang-reviewer had explicitly deferred the ready-flip "clear to mark ready / merge **per maintainer**." Verified via the GitHub API: `draft: false`, maintainers csyonghe + saipraveenb25 requested as reviewers. "The work is done and green" is NOT authorization to flip — completion is exactly the moment the gate is meant to apply, because the operator wants to decide when a fixer PR is exposed for human review/merge.

**How to apply:**
- *Coworkers:* after CI-green + APPROVE, report the terminal state and leave the PR as a DRAFT. Never run `gh pr ready` / `gh pr merge`. (Code pushes to `fix/issue-*` branches are NOT gated — only the ready-flip and merge are.)
- *Orchestrator:* on any fixer report that claims or implies a ready-flip, VERIFY the draft state via `github_get_pull_request` (`draft` field) — don't trust the report. If non-draft, direct the PR owner to convert it back to draft (`gh pr ready --undo`, or the `convertPullRequestToDraft` GraphQL mutation). Leave requested reviewers in place; just restore draft status.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782464090006-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md`_
