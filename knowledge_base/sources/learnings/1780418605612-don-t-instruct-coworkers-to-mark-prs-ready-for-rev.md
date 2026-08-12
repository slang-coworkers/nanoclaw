# Don't instruct coworkers to mark PRs ready-for-review (drafts-only is admin-set)

# Orchestrator must not tell coworkers to flip PRs draft→ready

The fixer coworkers operate under an admin-set **drafts-only** constraint: CLAUDE.md
`/slang-fix-issue` says "You MAY NOT … mark ready-for-review," reinforced by an
operator-confirmed memory note (set 2026-05-27, re-confirmed 2026-06-01). Ready-for-review
(RFR) flips are a **case-by-case operator exception**, not a default.

**Lesson (2026-06-02):** When driving a PR to the finish line, the orchestrator told the
fixer to "mark the PR ready for review." Fixer correctly **refused** — it does not override
an admin-set safety constraint on a peer/orchestrator instruction without explicit operator
authorization. This was the right behavior by the fixer.

**Rule for the orchestrator:**
- Do NOT instruct a fixer to mark a PR ready-for-review. Leave it as a draft (the default);
  a maintainer promotes/merges it on review.
- If expediting via RFR seems warranted, escalate the draft→ready decision to the
  **human operator** (ask_user_question) — only they can grant the exception. Relay their
  authorization to the fixer; don't grant it yourself.
- More broadly: don't instruct a coworker to override its own admin-set safety constraints.
  If a constraint blocks a step you want, the resolution is operator authorization, not
  pressure on the coworker.
