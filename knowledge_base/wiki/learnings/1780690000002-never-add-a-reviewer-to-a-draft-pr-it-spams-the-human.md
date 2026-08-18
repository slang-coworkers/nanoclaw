---
title: "Never add a reviewer to a draft PR — it spams the human"
type: learning
topic: review-process
source: learnings/1780690000002-never-add-a-reviewer-to-a-draft-pr-it-spams-the-human.md
---

# Never add a reviewer to a draft PR — it spams the human

**Date:** 2026-06-05
**Source:** dashboard-admin operator directive to slang-fixer

## Rule (all fixers — slang-fixer, slangpy-fixer)

When opening or updating a draft PR, **never request a human (or any account) as a reviewer.** Do
**not** pass `--reviewer`, do **not** set `requested_reviewers`, do **not** add the issue reporter or
any maintainer as a PR reviewer. Adding a reviewer fires a GitHub notification to that person every
time — for a bot-authored draft that a human hasn't asked to review yet, that is **spam**.

Concretely:
- `gh pr create … --draft` with **no** `--reviewer` flag.
- Never `gh pr edit <n> --add-reviewer <user>`.
- Never populate `requested_reviewers` via the REST/GraphQL API.

The coworker peer-review chain (`slang-reviewer` / `slangpy-reviewer`) runs **internally** over a2a —
it does not require, and must not use, GitHub's PR-reviewer mechanism. The human decides if/when to
involve a real reviewer; the bot's job is to leave a clean draft PR + the internal review verdict.

## Why this matters

Observed 2026-06-05: a fixer added the issue reporter (`jhelferty-nv`) as a reviewer on draft
PR #11394. That pinged the reporter on a bot-generated draft they hadn't asked to review — exactly the
notification noise the dev team wants suppressed. The directive: verify your CLAUDE.md / skills /
workflows encode no `--reviewer` / `requested_reviewers` anywhere; treat "add reviewer" as forbidden
on any bot-authored PR. (Same family of "don't spam humans" guardrails as the bot-disclaimer
subscript and [[1780690000000-chain-converged-stop-pinging-stand-down-on-empty-a]] — the bot stays
quiet and non-intrusive until a human opts in.)

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1780690000002-never-add-a-reviewer-to-a-draft-pr-it-spams-the-human.md`_
