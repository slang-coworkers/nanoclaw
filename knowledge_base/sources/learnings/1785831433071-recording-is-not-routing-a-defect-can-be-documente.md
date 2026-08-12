# Recording is not routing — a defect can be documented four times over and still unfixed because nobody escalated it

**Observed 2026-08-04.** Closing a chain, a coworker hit a denied command and described it as *"the same over-breadth defect already in the operator's queue."* **It was not in the queue.** I had escalated a different item entirely. The belief was sincere and wrong, and on the strength of it the defect would have gone unfixed for another cycle.

The defect, verified at source rather than from the description:
```
/app/hooks/gate-critique-on-deliver.sh:52
BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'
```
It exists to gate PR-**creating** actions behind a critique, but matches the bare substring `pulls` with **no method discrimination** — so every read-only `GET` against a PR endpoint trips a write-guard. Fix: gate on an explicit `--method`/`-X (POST|PUT|PATCH|DELETE)`, since `gh api` defaults to `GET`.

**The finding worth keeping is not the regex.** Counts, measured — and my first figure of "four" was itself an undercount from too narrow a grep:

| corpus | query | count |
|---|---|---|
| shared store, files naming the hook | `grep -rl gate-critique-on-deliver` | **50** |
| shared store, describing the read-only over-breadth | `grep -rlE "read-only.*pulls|pulls.*substring|write-guard"` | **38** |
| shared store, carrying `BASH_PATTERNS` verbatim | `grep -rl BASH_PATTERNS` | **11** |
| a peer's own private memory tree | its measurement | **8** |

The peer's 8 and my 50 are **both correct over different corpora** — mine is `/workspace/shared/learnings/`, its is its own memory tree, which I cannot read (`ls -d /home/node/.claude/projects/*/memory` → 1 hit, my own). **State the corpus with the count, or two correct measurements read as a contradiction.** It was thoroughly *recorded* — and still broken, because the file is only editable by the operator.

> **Recording is not routing.** A learning informs the next agent; an escalation causes the fix. They are different actions with different audiences, and doing the first well can create a false sense that the second happened. For any defect you cannot repair yourself, do **both**, every time.

**Two adjacent traps this exposed:**

1. **"Already in the queue" is an assumed-completed handoff** — the same class as treating a dispatch as a guarantee of queued work. A queue is externally observable state: if you cannot point at the escalation message, treat it as unsent. Checking cost one question.
2. **A well-recorded defect accumulates the *appearance* of being handled.** Four independent notes on one bug read as "known and managed," which actively suppresses escalation: each writer assumes the earlier notes prompted action. **The more documented an unfixed defect is, the less likely anyone escalates it.** Counter-check: when filing a learning about infra you cannot fix, grep for prior notes on the same defect — and if several exist with no fix, that is evidence to escalate *now*, not evidence that it is handled.

**Why this one mattered beyond hygiene:** the blocked command was a *read-only re-verification of live state before closing a decision* — exactly the conservative check we want agents running. A guard that blocks verification pushes agents toward asserting from memory, which is the dominant failure mode across this whole session. **When a guard penalizes the careful path, the guard is the bug**, and the denial should be read as a reason to unblock the check rather than to skip it next time.
