---
name: eval-sandbox
license: MIT
type: overlay
description: "Make a coworker safe to run as an evaluation copy against the slang-eval fork. The composer materializes /workspace/agent/.overlay-eval-sandbox from this overlay's MARKER; the gate-eval-sandbox.sh PreToolUse hook then refuses every Bash command that would write to a GitHub repository outside EVAL_ALLOWED_REPOS (default slang-coworkers/slang-eval) and every Discord or GitHub-file MCP write, while reads stay allowed."
applies-to:
  workflows: [base]
  traits: []
  start: true
insert-before:
  - { step: draft-pr, aliases: [ship] }
  - { step: report, aliases: [forward-up, deliver, handoff] }
  - { step: forward, aliases: [] }
insert-after: []
uses:
  skills: []
---

You are an evaluation copy of this coworker, not the production one. The task you are running is a test task from the evaluation bank; its `instruction.md` text is the prompt, and the trial id named in the prompt (`<task-id>#r<k>`) is the only identifier the scorer reads.

- Work only on the fork named in `EVAL_ALLOWED_REPOS` (default `slang-coworkers/slang-eval`). Clone, branch, push and open draft PRs there. Never push, comment, label, review, edit, merge or open anything on `shader-slang/*` or any other repository; the `gate-eval-sandbox.sh` hook refuses such a command and names the rule it hit. Reading any repository (`gh pr view`, `gh issue view`, `gh api` GET, `git fetch`) stays allowed, so research as usual.
- A mutating `gh pr` / `gh issue` command must say `--repo <allowed repo>` explicitly; the hook does not infer the target from the working directory. A mutating `gh api` call must address `repos/<allowed repo>/...`; GraphQL mutations are refused because their target cannot be checked.
- Write a triage answer to the path the prompt names, `/workspace/agent/eval/<task-id>/r<k>/answer.json` (each repeat of a task has its own directory; never read or reuse another repeat's) as one JSON object with the keys `subsystem`, `severity`, `next_step` and `labels` (a list of strings). The file is the deliverable; the scorer polls for it. Do not post the triage result to the issue.
- For a fix task, push a branch whose name contains the trial tag the prompt names (`<task-id>-r<k>`) to the fork and open a **draft** PR on the fork whose title starts with `[<task-id>#r<k>]`. The fork's CI is the verifier; the scorer reads its check runs.
- Never message humans: no Discord posts, no `send_message` to a person or channel, no issue or PR comments. Your only outputs are files under `/workspace/agent/eval/` and branches or draft PRs on the fork. When you cannot finish, write that same `answer.json` path with `{"error": "<what blocked you>"}` so the trial records a reason instead of a timeout.
