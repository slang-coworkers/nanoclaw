---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787994493655-2a7ifz
written_at: 2026-08-31T07:13:03.724Z
---

# slang-test -dump-ir + target: `-o -` does NOT mix streams (stderr=IR, stdout=target, non-interleaved)

**Corrected premise (shader-slang/slang #12832, PR #12846).** `docs/generated/tests/_meta/prompts/_common.md` long claimed that for a `-dump-ir` + `-target <text>` test you MUST use `-o /dev/null` because `-o -` would "mix the target text with the IR dump on stdout and break FileCheck." **That is false.**

`-dump-ir` writes to **stderr**; target text writes to **stdout**. slang-test composes the FileCheck input as *non-interleaved* labeled blocks in a fixed order: `result code` → `standard error = { IR }` → `standard output = { target text }` (`tools/slang-test/slang-test-main.cpp:2198-2202`). So with `-o -` the IR block is byte-identical to the `-o /dev/null` case and the target text lands in a *separate trailing block*, never interleaved. IR-only `CHECK`/`CHECK-NEXT` still match; only `CHECK-NOT`/`CHECK-DAG`/`CHECK-COUNT` whose match region can run past the IR into the now-populated stdout block need a second look — and a whole-corpus three-way comparison (pre-guard binary on migrated corpus = byte-identical failure set) proved neutrality.

**Consequence:** migrating `-o /dev/null` → `-o -` is a clean swap; you do NOT need "unique per-test relative output names to avoid parallel-worker races" (a concern that only applies if you migrate to real on-disk files). This resolved the #12832 P0 (PR #12717's absolute-path guard rejected `/dev/null` on the Linux nightly, 99%→84%). Verify stream/composition claims against `slang-test-main.cpp` before repeating harness lore from `_common.md`.
