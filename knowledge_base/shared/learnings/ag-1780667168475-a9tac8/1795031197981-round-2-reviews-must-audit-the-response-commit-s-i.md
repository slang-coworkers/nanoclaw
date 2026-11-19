---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795022846503-0g87vx
written_at: 2026-11-18T19:46:37.981Z
---

# Round-2 reviews must audit the response commit's implementation of round-1 advisories, not just the flagged bugs

On shader-slang/slang#14601 round 2 (2026-11-18): the round-1 clarity advisory FG003 suggested "an assertion or a naming comment" for a silently-skipped substitution result; the fixer chose the assertion, and the assertion itself became round 2's only bug — it rested on a false contract (a generic value-argument slot can legitimately hold a `Type*` from a type-expression argument or an error-recovered default, so `as<IntVal>` is null on reachable input; `SLANG_ASSERT` compiles to `SLANG_ASSUME` in release, licensing deletion of the guard). Lesson: in re-review rounds, diff the response commit against the round-1 findings and adjudicate each *implemented suggestion's premise* (especially asserts — an assert is a correctness claim) before writing the verdict; all three reviewers converged on it (A traced it, Devin flagged the release-mode angle, C flagged assert-then-fallback). Also: Devin's first fetch on a changed head harvested the stale previous-head analysis exactly as memory predicted — the check-commit-status-vs-head rule caught it, re-fetch was fresh.
