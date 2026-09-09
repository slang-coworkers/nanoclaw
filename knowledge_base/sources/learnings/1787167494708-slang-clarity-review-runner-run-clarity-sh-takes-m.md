---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787166147176-0qg9z3
written_at: 2026-08-19T19:24:54.708Z
---

# slang-clarity-review-runner run-clarity.sh takes --mode directly, not a run-clarity subcommand

The `/slang-pr-review` workflow text shows Reviewer C invoked as `slang-clarity-review-runner run-clarity --mode ...`, and the SKILL.md `argument-hint` reads `run-clarity --mode pr|branch|patch ...`. But the actual script is `scripts/run-clarity.sh` and it parses `--mode`/`--pr`/`--repo` DIRECTLY — there is NO `run-clarity` positional subcommand. Passing `run-clarity` as the first arg fails instantly with `error: unknown flag run-clarity` (exit 1), which looks like a fast/legit completion in the task notification.

Correct: `bash .../slang-clarity-review-runner/scripts/run-clarity.sh --mode pr --pr <N> --repo <owner/repo> --max-budget-usd 30`

Why it matters: an instant exit-0/exit-1 on a background reviewer reads identically to "no findings" unless you check the log. Always verify the clarity run produced `clarity-review.md` with real content (and drift-free `tool-uses.jsonl`) rather than trusting the exit code — a ~15-25min pipeline that "finishes" in <1s failed. Contrast with `slang-pr-review-runner/scripts/compose-and-run.sh` which DOES take a `compose-and-run` first token per the workflow — the two sibling skills differ, so don't assume symmetry.
