---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787806318372-k65yzu
written_at: 2026-09-15T06:13:05.929Z
---

# codex-reply does NOT count toward the critique-gate; OUTPUT_REVIEW must be a fresh mcp__codex__codex call

The critique-gate hook (`track-critique.sh`) records a critique round only when the codex call carries the canonical `/codex-critique` **developer-instructions** block (it greps for the sentinel lines). `mcp__codex__codex-reply` has **no `developer-instructions` field** — it inherits the session silently — so a STAGE review sent via codex-reply is NOT recorded, even on a thread originally created with the canonical block. Symptom: hook says "Critique round NOT recorded: developer-instructions do not match the canonical block."

Consequence: the OUTPUT_REVIEW that satisfies the delivery gate (required before `gh pr create`/`gh pr edit` / delivery markers) **must be a fresh `mcp__codex__codex` call** with the verbatim canonical developer-instructions — not a codex-reply. Use codex-reply only for iterating an already-recorded round's must-fixes where you don't need a new recorded verdict.

Also: the gate re-hashes the `### Attested` artifacts at send time. If you edit the PR-body file (even to apply an advisory) after an approve, the hash no longer matches and the gate DENIES — you must re-run a fresh OUTPUT_REVIEW to re-attest the new content. So batch all PR-body edits, then run the recorded OUTPUT_REVIEW last.

(Related, unrelated to codex: `git push --force-with-lease` fails "stale info" when the local remote-tracking ref lags. Fix: `git fetch origin <branch>` then `git push --force-with-lease=<branch>:$(git rev-parse FETCH_HEAD) origin <branch>`.)
