---
title: "An unchanged CI run id on a terminal PR means dead, not stuck — gate applicability before measuring staleness"
type: learning
topic: agent-ops
source: learnings/1786020942273-an-unchanged-ci-run-id-on-a-terminal-pr-means-dead.md
---

# An unchanged CI run id on a terminal PR means dead, not stuck — gate applicability before measuring staleness

Two halves of one bug, confirmed on slang-fixer/orchestrator 2026-08-06. A CI-supervisor probe nudged "PR #11564 ❌ stale: failure run 27796816045, SAME id as last tick — rebase to re-dispatch." Every part of the premise was wrong, and the shape recurs.

**1. Gate applicability BEFORE measurement.** The probe computed behindness/staleness without first checking `state`. A **closed or merged** PR reports its last failure *forever* and re-nudges every tick. Cheap fix:
```bash
gh pr view <n> --json state,mergedAt   # OPEN? else skip entirely
```
Sweep result once applied: **7 of 30 CI nudges that tick targeted non-OPEN PRs** (merged #12081/#11923/#11942, closed #791/#11564/#12159) — 2 had already been dispatched to workers.

**2. The signal inverts — this is the part that gets read backwards.** An identical run id across two ticks *feels* like "nobody re-dispatched → neglect → nudge harder." It is the opposite: on a terminal PR, **an unchanged run id is the signature of a frozen artifact — the PR is dead (or CI never ran), not stuck.** Reading it as neglect turns a no-op into recurring work assigned against a worker who can't act. Rule: unchanged run id ⇒ "terminal or never ran" until PR `state` says otherwise.

**3. Cross-subsystem staleness.** The same chain asked me to rebase a worktree *it had authorized me to delete two days earlier* — its GC bookkeeping and CI probe didn't read each other. If two supervisor subsystems can act on the same resource, one must be able to see the other's mutations, or verify existence at dispatch time (`ls -d <wt>` / `git worktree list`).

**4. Don't put operator-gated actions in a worker nudge.** "Once green, mark ready for review" asks for `gh pr ready`, which is operator-gated by standing policy — and is a no-op on an already-non-draft PR. A genuine ready-flip routes to the operator, never to the worker.

**Generalization:** before asserting a resource is *stale/behind/neglected*, ask *is this resource still live, and does my instrument distinguish "unchanged because frozen" from "unchanged because ignored"?* Same family as the GC derived-branch-name bug: a probe that fails toward "go ahead / act on it" deserves more scrutiny than one that fails loudly.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786020942273-an-unchanged-ci-run-id-on-a-terminal-pr-means-dead.md`_
