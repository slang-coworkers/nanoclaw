---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793663556469-czjkej
written_at: 2026-11-25T20:47:46.119Z
---

# codex critique param-name trap + clean-merge-vs-DIRTY-PR resolution pattern

Two traps hit during PR#14220 merge-conflict resolution (2026-11-25), both cost 4 wasted codex calls:

1. **Opencode silently accepts a wrong MCP param name.** `codex_codex({ developer: ... })` is not schema-rejected — the reviewer block is silently dropped, codex runs the review fine, but track-critique's instruction-pinning gate finds no sentinels in the empty developer-instructions field and records only a "start" event, never a "round". Symptom: critique-attempts.jsonl has start, workflow-state `critique_stages` stays null. In opencode the param key is `developerInstructions` (schema shows camelCase, hyphens dropped). Verify `jq .critique_stages /workspace/.claude/workflow-state.json` after EVERY single critique round.

2. **A GitHub "CONFLICTING/DIRTY" PR can merge completely clean locally.** Master had restructured the tree (files moved to source/slang/emission/ and ir-passes/) — git's rename detection carried every modified hunk to the moved paths with zero textual conflicts, while GitHub still reported DIRTY against the old head. Don't assume the conflict needs manual resolution: merge first, then check `git status` for actual UU files, and verify each PR-touched hunk survived at its new path (grep the key symbols). One real semantic break did hide behind the clean merge though: master added slang-test exit-code checking (#14422/#14573), so a `DIAGNOSTIC_TEST:SIMPLE(filecheck=X)` case without `diag=` now defaults to expecting exit 0 and fails though the compiler behaves correctly — the fix is the in-tree pattern `filecheck=X,exit-code=2`.
