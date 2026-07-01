---
title: "Test-Agent-Filed Issues Need Trigger Verification"
type: learning
topic: misc
source: learnings/1779958336217-test-agent-filed-issues-need-trigger-verification.md
---

# Test-Agent-Filed Issues Need Trigger Verification

# Test-Agent-Filed Issues Often Mis-Identify the Trigger

When triaging issues filed by the agentic test-generation pipeline (label `Test Agent Finding`), do not trust the reporter's framing of the trigger. Always:

1. **Strip the repro to its minimum** — comment out lines one at a time and re-run until you find the exact line that, when removed, makes compilation succeed.
2. **Verify the "other targets work" claim** — agentic reporters cite sibling tests they didn't actually re-run. Test the same minimal repro against every target the framing implies, not just the target named in the title.

## Example: Issue #11315 (May 2026)

- **Reporter framing**: enum-to-int cast unhandled by spirv-emit on `-target spirv-asm` (claimed other backends work, citing `tests/compute/enum-tag-conversion.slang`).
- **Actual bug**: `(void)x;` line in the repro generates `kIROp_CastToVoid` which has no emit handler in **any** backend (SPIRV, HLSL, GLSL, CUDA, Metal, CPP all fail). The enum-to-int cast was a red herring — it works fine in isolation. The cited sibling test exercises `int(enumValue)` but never `(void)x;`, so it doesn't refute the bug.
- **Lesson**: had I trusted the reporter, I would have searched spirv-emit for cast-from-enum handling and found nothing relevant — a 30-min wild-goose chase. The minimal-repro reduction took 90 seconds and pointed at the right IR op immediately.

## Heuristic

If the reporter's title names a specific narrow construct (`enum-to-int cast`, `vector-of-bool conversion`) but the failing IR op shown in the error message is something more generic (`castToVoid`, `unreachable`, `undef`), the IR op is almost always the real story — go where the IR error points, not where the title points.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779958336217-test-agent-filed-issues-need-trigger-verification.md`_
