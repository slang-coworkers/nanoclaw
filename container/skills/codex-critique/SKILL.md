---
name: codex-critique
license: MIT
description: "Independent second-opinion review by codex. You call mcp__codex__codex directly — no subagent. Read-only — produces a structured critique, never modifies files."
provides: [critique.review]
allowed-tools: Read, Grep, Glob, Bash(git diff:*), mcp__codex__codex, mcp__codex__codex-reply
---

# Codex Critique

You call `mcp__codex__codex` yourself — no subagent. Codex runs in a separate process, gets a fresh session, and has read-only filesystem access.

## Call

```
mcp__codex__codex({
  prompt:                 <see below>,
  developer-instructions: <see below>,
  sandbox:                "danger-full-access",
  cwd:                    "/workspace/agent",
})
```

Capture `threadId` — required for round 2/3 via `mcp__codex__codex-reply`.

**Pass file paths, not contents.** Codex can read the workspace; pasting bodies wastes tokens.

## Prompt

```
STAGE: <DIAGNOSIS_REVIEW | PLAN_REVIEW | CODE_REVIEW | OUTPUT_REVIEW>

TASK (verbatim — only you have this, codex cannot read it from disk):
<paste the original user request, no paraphrasing>

WHAT I DID:
<1-3 sentence summary of the action or decision at this stage>

WHY:
<reasoning, evidence, tradeoffs considered>

ARTIFACTS (read these yourself):
<file paths, or "run git diff <base>..HEAD" for code review>
```

## When to invoke each STAGE

Run each stage at the natural transition in your workflow. If `critique-gate` is in your overlay set and your coworker type declares required stages, the gate denies delivery markers / `gh pr create` until each required stage has at least one round recorded — the denial message names what's missing, so a forgotten stage costs at most one extra turn.

| Stage | Run after | Pass to codex |
|---|---|---|
| `DIAGNOSIS_REVIEW` | You've identified the root cause / what's being asked | The issue/request; your reading of it; relevant file:line pointers |
| `PLAN_REVIEW` | You've chosen an approach, before editing source | The plan file (`/workspace/agent/reports/<n>.md` or equivalent); the candidate approaches you considered |
| `CODE_REVIEW` | Your edits + tests pass, before reporting / opening PR | `git diff <base>..HEAD`; the test path + result |
| `OUTPUT_REVIEW` | Your deliverable (Fix Report, message, answer) is drafted, before sending | The deliverable text or path; the artifacts it references |

A coworker doing answer-style work (responding to a Discord question, drafting a release note, etc.) uses `OUTPUT_REVIEW` — codex reads the question + sources + draft and verifies factual accuracy and source coverage from the artifacts. There is no separate `ANSWER_REVIEW` stage.

## developer-instructions

```
You are an independent reviewer with read-only workspace access.
Read the artifacts yourself — verify every claim against the code, not by analogy.
Guard against scope shrinkage: if the deliverable reduces scope below the original spec without evidenced blockers, flag it as must-fix.
Return ONLY the structured output below.

### Verdict
One of: approve | must-fix

### Must-fix (blocks merge)
- <file:line> — what is wrong, why, the fix.

### Advisory
- <file:line> — concern + suggestion. Author may decline with justification.

### Notes
- Observations for future work. No "what" without "why."
```

## Rounds

- `must-fix` → fix the items → call `mcp__codex__codex-reply` with the saved `threadId` and a follow-up ("I addressed items 1, 2, 3 — re-verify").
- 3 rounds with unresolved `must-fix` → stop, escalate to parent.
- `advisory` → address or justify declining. Your call.
