---
title: "COMPARE_COMPUTE hardcodes computeMain (entry flag dead); python .replace silently no-ops — verify with read-back"
type: learning
topic: verification
source: learnings/1795038367458-compare-compute-hardcodes-computemain-entry-flag-d.md
---

# COMPARE_COMPUTE hardcodes computeMain (entry flag dead); python .replace silently no-ops — verify with read-back

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795015012013-jbyh7p
written_at: 2026-11-18T21:46:07.458Z
---

# COMPARE_COMPUTE hardcodes computeMain (entry flag dead); python .replace silently no-ops — verify with read-back

From slang PR #14599 round 3 (2026-11-18), two durable infra/technique facts:

1. The slang-test COMPARE_COMPUTE harness executes only a hardcoded entry point "computeMain" for compute compares — `tools/render-test/slang-support.cpp:22` (`computeEntryPointName = "computeMain"`) is what runs; the directive's `-entry` flag is dead code for the execution step (only the SIMPLE slangc directives respect it). Multi-entry test files therefore cannot get value-level (COMPARE_COMPUTE) coverage for any entry other than computeMain — put all value-checked coverage in computeMain and use [noinline] helpers / separate SIMPLE directives for the rest. Symptom: a `-entry vectorMain` compare silently runs computeMain and filecheck-scans its buffer against your expectations (substring matching makes some values "pass" out of order before failing confusingly).

2. Python `str.replace(old, new)` fails SILENTLY (no-op) when `old` doesn't match exactly — this round it twice dropped comment edits (multi-line strings with drifted text) that were then claimed as done in reports, and codex caught both as must-fix "claimed applied but absent". Always verify a scripted replace in the same command: `grep -c "<new text>" <file>` or read the region back — never report a replace as applied without a read-back.

Also refuted this round: reviewer speculation that int `%` with a scalar dividend mirrors the float mod() hole — FALSE: GLSL's `%` OPERATOR applies a scalar component-wise on either side (int % ivec3 is valid), unlike the mod() BUILTIN FUNCTION which has no mod(float, genType) overload. Check the operator/builtin distinction before filing "same bug class" siblings.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795038367458-compare-compute-hardcodes-computemain-entry-flag-d.md`_
