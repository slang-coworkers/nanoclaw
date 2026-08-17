---
title: "codex-critique: codex-reply cannot record a gate stage; verify the round actually counted"
type: learning
topic: agent-ops
source: learnings/1785908614073-codex-critique-codex-reply-cannot-record-a-gate-st.md
---

# codex-critique: codex-reply cannot record a gate stage; verify the round actually counted

Two ways a critique round silently fails to register with the delivery gate (`gate-critique-on-deliver.sh` / `track-critique.sh`), both observed 2026-08-05 on slang#12355:

**1. `mcp__codex__codex-reply` cannot record a stage.** The skill text says to re-verify a `must-fix` by replying on the saved `threadId`. But `track-critique.sh` enforces *instruction pinning*: a call carrying `STAGE: X` only counts when its `developer-instructions` contain the two canonical sentinels ("You are an independent reviewer", "Return ONLY the structured output below"). `codex-reply` has no `developer-instructions` field at all, so a reply that carries a `STAGE:` marker is **rejected with "Critique round NOT recorded"**. Re-verification must be a **fresh `mcp__codex__codex` call** with the full canonical block. (The hook exempts replies that inherit a stage via the recorded thread map, but only when the reply carries no STAGE of its own — don't rely on it; just make a fresh call.)

**2. A round can drop with no error at all.** I made an `mcp__codex__codex` call with `STAGE: OUTPUT_REVIEW`, correct canonical instructions, and got a clean `### Verdict approve` back — and it was **not recorded**: no confirmation reminder, `critique_rounds` stuck at 4, and the gate still denied `gh pr create` citing the previous `must-fix`. Re-running the same review with `STAGE: OUTPUT_REVIEW` as the **literal first line of the prompt** (rather than after a ~300-byte environment preamble) recorded fine.

**So: never assume the verdict landed. Check the ledger.**
```bash
jq '{critique_rounds, critique_stages, critique_verdicts}' /workspace/.claude/workflow-state.json
```
If `critique_rounds` didn't increment, the round didn't count regardless of what codex returned to you. The gate needs every required stage at count ≥ 1 **and** `OUTPUT_REVIEW = approve`.

**Also useful:** the `### Attested` sha256 list binds the approve to exact file contents — the gate re-hashes at send time and denies if an artifact changed after the approve. So finish your edits *before* the final OUTPUT_REVIEW, then `sha256sum` your deliverable and confirm it matches the attestation before delivering. Editing the PR body after an approve invalidates it.

**Sandbox:** always pass `sandbox: "danger-full-access"`; `read-only` is rejected by a PreToolUse hook because bwrap doesn't work inside Docker. And prepend an "ENVIRONMENT NOTE: LINUX container, use `git` not `git.exe`" line — but put it *after* the `STAGE:` line, not before.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785908614073-codex-critique-codex-reply-cannot-record-a-gate-st.md`_
