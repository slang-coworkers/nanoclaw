---
name: codex-critique
license: MIT
description: 'Independent second-opinion review by codex. You call mcp__codex__codex directly — no subagent. Read-only — produces a structured critique, never modifies files.'
provides: [critique.review]
allowed-tools: Read, Grep, Glob, Bash(git diff:*), mcp__codex__codex, mcp__codex__codex-reply
---

# Codex Critique

You call `mcp__codex__codex` yourself — no subagent. Codex runs in a separate process, fresh session, read-only filesystem. Pass file paths, not contents. Capture `threadId` — needed for rounds 2/3 via `mcp__codex__codex-reply`.

**IMPORTANT: Always pass `sandbox: "danger-full-access"`.** Any other value (including "read-only") will be rejected by a PreToolUse hook — bwrap sandboxing does not work inside Docker containers.

```
mcp__codex__codex({ prompt: <below>, developer-instructions: <below>, sandbox: "danger-full-access", cwd: "/workspace/agent" })
```

## Prompt

```
STAGE: <DIAGNOSIS_REVIEW | PLAN_REVIEW | CODE_REVIEW | DECISION_REVIEW | OUTPUT_REVIEW>

TASK (verbatim — only you have this, codex cannot read it from disk):
<the original user request, no paraphrasing>

WHAT I DID: <1-3 sentence summary of this stage's action/decision>
WHY: <reasoning, evidence, tradeoffs>
ARTIFACTS (read these yourself): <file paths, or "run git diff <base>..HEAD">
```

## When to invoke each STAGE

Run each at its natural workflow transition. If `critique-gate` is in your overlay set with required stages, the gate denies delivery markers / `gh pr create` until each has a recorded round (naming what's missing).

| Stage              | Run after                                 | Pass to codex                                                        |
| ------------------ | ----------------------------------------- | -------------------------------------------------------------------- |
| `DIAGNOSIS_REVIEW` | Root cause / request identified           | Issue; your reading; file:line pointers                              |
| `PLAN_REVIEW`      | Approach chosen, before editing           | Plan file (`/workspace/agent/reports/<n>.md`); approaches considered |
| `CODE_REVIEW`      | Edits + tests pass, before reporting / PR | `git diff <base>..HEAD`; test path + result                          |
| `DECISION_REVIEW`  | Verdict derived, before recording it      | The derivation: clauses from data, verdict parse vs. the review doc, source tier stated |
| `OUTPUT_REVIEW`    | Deliverable drafted, before sending       | Deliverable text/path; referenced artifacts                          |

Answer-style work (a question, a release note) uses `OUTPUT_REVIEW` for factual accuracy and source coverage. No separate `ANSWER_REVIEW` stage.

## developer-instructions

```
You are an independent reviewer with read-only intent but you MAY run read commands (git, cat, grep) to inspect artifacts. Read the artifacts yourself — verify every claim against the code, not by analogy.
Guard against scope shrinkage: if the deliverable reduces scope below spec without evidenced blockers, flag it must-fix.
Comment hygiene (when a code diff is under review): a comment that restates what the adjacent line already says, or that narrates change-history / scratchpad reasoning / why-an-alternative-was-rejected (that content belongs in the PR body or commit message, not source), is must-fix. A concise comment explaining non-obvious *why* — intent, an invariant, a subtle edge case — is correct: do NOT flag those, and do NOT demand comments on self-evident code.
Return ONLY the structured output below.

### Verdict
approve | must-fix

### Must-fix (blocks merge)
- <file:line> — what is wrong, why, the fix.

### Advisory
- <file:line> — concern + suggestion. Author may decline with justification.

### Notes
- Observations for future work. No "what" without "why."

### Attested
- <sha256> <path> — one line per file artifact you actually read (run `sha256sum <path>` yourself, up to 20 files). Write `- none` if this review had no file artifacts.
```

> Use this block **verbatim**. `track-critique.sh` verifies the sentinel lines
> ("You are an independent reviewer", "Return ONLY the structured output
> below") before recording a critique round — a codex call with rewritten
> instructions does not count toward the delivery gate. Keep the sentinels in
> sync with the hook if this block is ever edited.
>
> The `### Attested` hashes bind the verdict to the exact artifacts reviewed:
> the delivery gate re-hashes them at send time and denies if any changed
> after the approve. Attestation is opportunistic — no `### Attested` section
> means no hash check — but an approve with stale hashes will not ship.

## Rounds

- `must-fix` → fix → `mcp__codex__codex-reply` with the saved `threadId` ("addressed items 1,2,3 — re-verify").
- 3 rounds with unresolved `must-fix` → stop, escalate to parent.
- `advisory` → address or justify declining. Your call.
