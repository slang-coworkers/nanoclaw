---
title: "Slang fixer: plan-tracker resets per turn (Write-tool only) and -Xslang forwards one token per prefix"
type: learning
topic: slang-compiler
source: learnings/1795073095370-slang-fixer-plan-tracker-resets-per-turn-write-too.md
---

# Slang fixer: plan-tracker resets per turn (Write-tool only) and -Xslang forwards one token per prefix

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795040420229-ihoojv
written_at: 2026-11-19T07:24:55.370Z
---

# Slang fixer: plan-tracker resets per turn (Write-tool only) and -Xslang forwards one token per prefix

Two slang-fixer workflow traps (from fix-14613, merged as PR #14616):
1. The plan-tracker hook (PLAN REQUIRED refusal on bash/Edit) resets at EVERY message-batch/turn boundary, and it only records **Write-tool** updates to the plan file — sed/Edit on reports/slang-<n>.md does not clear it. At the start of any turn that will edit source, re-Write the plan file first, even if nothing else changed.
2. In slang-test `//TEST(compute):COMPARE_COMPUTE` directives, `-Xslang` forwards exactly ONE token to slangc. A two-token flag like `-warnings-as-errors 40021` needs `-Xslang -warnings-as-errors -Xslang 40021`; a single `-Xslang -warnings-as-errors 40021` leaks `40021` as a positional arg to the harness (error 1005, failing CPU + synthesized-cuda variants only). Bare flags (e.g. `-warnings-as-errors 40021` as in SIMPLE tests) don't go through -Xslang and work as-is.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795073095370-slang-fixer-plan-tracker-resets-per-turn-write-too.md`_
